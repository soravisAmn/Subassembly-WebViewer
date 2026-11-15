// Round 8: projects open in browser tabs (design section 2.1, user answer 8).
//   No single open project on the server: each tab opens its own project and gets a handle, sent back in the header
//   X-SA-Project on every request. Several projects can be open in several tabs at once.
//   A second tab on a project that a live handle already holds gets a read-only handle (writes are refused).
//   A handle is live while its tab's page socket says it holds it, or it was used in the last LiveFor.
//   Handles live in memory: after a server restart the page re-opens its project by path.

using System.Collections.Concurrent;

namespace SA.Projects;

public sealed class ProjectContext
{
    public string Handle { get; init; } = "";
    public string? ProjectFile { get; set; }               // absolute *.assembly.json; null = no project (scratch / old folder)
    public string ProjectDir { get; set; } = "";
    public bool ReadOnly { get; set; }
    public string? Tab { get; init; }
    public bool Legacy { get; init; }                      // requests without a handle (old fixed folder, until the page sends handles)
    public HashSet<string> Referenced { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public DateTime LastSeen { get; set; }
    public long Focus { get; set; }                        // larger = focused more recently (MCP default target)

    public string Name => ProjectFile == null ? "" : Path.GetFileName(ProjectFile)[..^SA.Projects.ProjectFile.Ext.Length];

    // A file name / relative path of a request, resolved in this project (outside the folder only if referenced)
    public string? Resolve(string? rel, params string[] exts) => ProjectPaths.Resolve(ProjectDir, rel, Referenced.Contains, exts);
}

public sealed class ProjectRegistry
{
    readonly ConcurrentDictionary<string, ProjectContext> _byHandle = new();
    readonly object _gate = new();
    long _clock;

    public ProjectContext Legacy { get; }
    public string ScratchDir { get; }
    public Func<DateTime> Now { get; set; } = () => DateTime.UtcNow;
    public TimeSpan LiveFor { get; set; } = TimeSpan.FromSeconds(60);
    // Handles the open page sockets hold (set by the MCP page hub); null = none known
    public Func<IReadOnlyCollection<string>>? SocketHandles { get; set; }

    public ProjectRegistry(string legacyDir, string scratchDir)
    {
        Legacy = new ProjectContext { Handle = "", ProjectDir = Path.GetFullPath(legacyDir), Legacy = true };
        ScratchDir = Path.GetFullPath(scratchDir);
    }

    public IReadOnlyCollection<ProjectContext> All => _byHandle.Values.ToList();

    // null handle = no header (old folder); unknown handle = null (project lost: the page re-opens it)
    public ProjectContext? Get(string? handle)
    {
        if (string.IsNullOrEmpty(handle)) return Legacy;
        if (!_byHandle.TryGetValue(handle, out var c)) return null;
        c.LastSeen = Now();
        return c;
    }

    public bool IsLive(ProjectContext c) =>
        (SocketHandles?.Invoke().Contains(c.Handle) ?? false) || Now() - c.LastSeen < LiveFor;

    // Opens projectFile for a tab. projectFile null = a scratch context (no project file).
    public ProjectContext Open(string? projectFile, string? tab, HashSet<string>? referenced = null)
    {
        lock (_gate)
        {
            string? full = projectFile == null ? null : Path.GetFullPath(projectFile);
            // the same tab re-opening (reload, or another project): its old handles go
            if (!string.IsNullOrEmpty(tab))
                foreach (var old in _byHandle.Values.Where(c => c.Tab == tab).ToList()) _byHandle.TryRemove(old.Handle, out _);
            bool held = full != null && _byHandle.Values.Any(c => !c.ReadOnly && string.Equals(c.ProjectFile, full, StringComparison.OrdinalIgnoreCase) && IsLive(c));
            var ctx = new ProjectContext
            {
                Handle = Guid.NewGuid().ToString("N"),
                ProjectFile = full,
                ProjectDir = full == null ? ScratchDir : Path.GetDirectoryName(full)!,
                ReadOnly = held,
                Tab = tab,
                Referenced = referenced ?? new(StringComparer.OrdinalIgnoreCase),
                LastSeen = Now(),
                Focus = Interlocked.Increment(ref _clock),
            };
            _byHandle[ctx.Handle] = ctx;
            return ctx;
        }
    }

    // Save as: the handle now points at another project file (refused when a live tab holds that file)
    public bool Move(ProjectContext c, string newFile)
    {
        lock (_gate)
        {
            var full = Path.GetFullPath(newFile);
            if (_byHandle.Values.Any(o => o != c && !o.ReadOnly && string.Equals(o.ProjectFile, full, StringComparison.OrdinalIgnoreCase) && IsLive(o))) return false;
            c.ProjectFile = full;
            c.ProjectDir = Path.GetDirectoryName(full)!;
            return true;
        }
    }

    public void Close(string? handle)
    {
        if (!string.IsNullOrEmpty(handle)) _byHandle.TryRemove(handle, out _);
    }

    public void Focused(string? handle)
    {
        if (!string.IsNullOrEmpty(handle) && _byHandle.TryGetValue(handle, out var c)) c.Focus = Interlocked.Increment(ref _clock);
    }

    // MCP: a project named by the caller (name, file name or full path), else the most recently focused live tab
    public ProjectContext? Find(string? project)
    {
        var live = _byHandle.Values.Where(IsLive).OrderByDescending(c => c.Focus).ToList();
        if (string.IsNullOrWhiteSpace(project)) return live.FirstOrDefault();
        project = project.Trim();
        return live.FirstOrDefault(c => c.ProjectFile != null &&
            (string.Equals(c.ProjectFile, project, StringComparison.OrdinalIgnoreCase)
             || string.Equals(Path.GetFileName(c.ProjectFile), project, StringComparison.OrdinalIgnoreCase)
             || string.Equals(c.Name, project, StringComparison.OrdinalIgnoreCase)));
    }
}
