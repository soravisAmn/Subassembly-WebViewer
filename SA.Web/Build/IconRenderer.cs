// Round 7 M3: tool image for the .atc, drawn on the server from a simulator run (web and hand-written files alike, no page
// needed): shapes filled light blue, links dark blue, white background, cropped to the section and fitted into 256 × 256
// (the .atc declares 64 × 64 like the stock tools; Civil 3D scales). 4 × supersampling for smooth lines. No labels.
// The icon editor comes in round 11.

using System.IO.Compression;
using System.Text.Json;

namespace SA.Build;

public static class IconRenderer
{
    const int Max = 256, Pad = 10, SS = 4;
    static readonly (byte R, byte G, byte B) Fill = (0xCF, 0xE3, 0xF7), Line = (0x1B, 0x3A, 0x5C), Grey = (0x8A, 0x8F, 0x96);

    // PNG of the section, or null when there is nothing to draw
    public static byte[]? Render(RunOutput o)
    {
        var pts = o.Points.Select(p => (p.X, p.Y)).ToList();
        var links = new List<List<(double X, double Y)>>();
        var shapes = new List<List<(double X, double Y)>>();
        foreach (var l in o.Links)
        {
            var e = JsonSerializer.SerializeToElement(l);
            var idx = e.GetProperty("pts").EnumerateArray().Select(x => x.GetInt32()).Where(i => i >= 0 && i < pts.Count).ToList();
            if (idx.Count >= 2) links.Add(idx.Select(i => pts[i]).ToList());
        }
        foreach (var s in o.Shapes)
        {
            var e = JsonSerializer.SerializeToElement(s);
            if (e.TryGetProperty("polygon", out var poly) && poly.ValueKind == JsonValueKind.Array)
            {
                var idx = poly.EnumerateArray().Select(x => x.GetInt32()).Where(i => i >= 0 && i < pts.Count).ToList();
                if (idx.Count >= 3) shapes.Add(idx.Select(i => pts[i]).ToList());
            }
        }
        if (links.Count == 0 && shapes.Count == 0) return null;
        return Draw(shapes, links, Line);
    }

    // Plain image when the section cannot be drawn (the report says so)
    public static byte[] Generic()
    {
        var trap = new List<(double, double)> { (0, 0), (3, 0), (4, -2), (-1, -2) };
        return Draw(new() { trap }, new() { trap.Append(trap[0]).ToList() }, Grey);
    }

    static byte[] Draw(List<List<(double X, double Y)>> shapes, List<List<(double X, double Y)>> links, (byte R, byte G, byte B) lineColor)
    {
        var all = shapes.SelectMany(s => s).Concat(links.SelectMany(l => l)).ToList();
        double x0 = all.Min(p => p.X), x1 = all.Max(p => p.X), y0 = all.Min(p => p.Y), y1 = all.Max(p => p.Y);
        double w = Math.Max(x1 - x0, 1e-6), h = Math.Max(y1 - y0, 1e-6);
        double k = Math.Min((Max - 2 * Pad) / w, (Max - 2 * Pad) / h);
        int W = Math.Clamp((int)Math.Round(w * k) + 2 * Pad, 32, Max), H = Math.Clamp((int)Math.Round(h * k) + 2 * Pad, 32, Max);
        double ox = (W - w * k) / 2, oy = (H - h * k) / 2;
        int BW = W * SS, BH = H * SS;
        var buf = new byte[BW * BH * 3];
        Array.Fill(buf, (byte)255);
        (double X, double Y) P((double X, double Y) p) => ((ox + (p.X - x0) * k) * SS, (H - oy - (p.Y - y0) * k) * SS);

        void Set(int x, int y, (byte R, byte G, byte B) c)
        {
            if (x < 0 || y < 0 || x >= BW || y >= BH) return;
            int i = (y * BW + x) * 3; buf[i] = c.R; buf[i + 1] = c.G; buf[i + 2] = c.B;
        }

        // shapes: even-odd scanline fill at pixel centres
        foreach (var s in shapes)
        {
            var q = s.Select(P).ToList();
            int ya = Math.Max(0, (int)Math.Floor(q.Min(p => p.Y))), yb = Math.Min(BH - 1, (int)Math.Ceiling(q.Max(p => p.Y)));
            var xs = new List<double>();
            for (int y = ya; y <= yb; y++)
            {
                double cy = y + 0.5; xs.Clear();
                for (int i = 0; i < q.Count; i++)
                {
                    var a = q[i]; var b = q[(i + 1) % q.Count];
                    if ((a.Y <= cy) != (b.Y <= cy)) xs.Add(a.X + (cy - a.Y) / (b.Y - a.Y) * (b.X - a.X));
                }
                xs.Sort();
                for (int i = 0; i + 1 < xs.Count; i += 2)
                    for (int x = Math.Max(0, (int)Math.Ceiling(xs[i] - 0.5)); x <= Math.Min(BW - 1, (int)Math.Floor(xs[i + 1] - 0.5)); x++) Set(x, y, Fill);
            }
        }

        // links: discs stamped along each segment (2 px wide in the final image)
        double r = 1.0 * SS;
        foreach (var l in links)
            for (int i = 0; i + 1 < l.Count; i++)
            {
                var a = P(l[i]); var b = P(l[i + 1]);
                double len = Math.Sqrt((b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y));
                int n = Math.Max(1, (int)Math.Ceiling(len));
                for (int j = 0; j <= n; j++)
                {
                    double cx = a.X + (b.X - a.X) * j / n, cy = a.Y + (b.Y - a.Y) * j / n;
                    for (int y = (int)Math.Floor(cy - r); y <= (int)Math.Ceiling(cy + r); y++)
                        for (int x = (int)Math.Floor(cx - r); x <= (int)Math.Ceiling(cx + r); x++)
                            if ((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy) <= r * r) Set(x, y, lineColor);
                }
            }

        // downsample SS × SS -> 1
        var img = new byte[W * H * 3];
        for (int y = 0; y < H; y++)
            for (int x = 0; x < W; x++)
                for (int c = 0; c < 3; c++)
                {
                    int sum = 0;
                    for (int dy = 0; dy < SS; dy++)
                        for (int dx = 0; dx < SS; dx++) sum += buf[((y * SS + dy) * BW + x * SS + dx) * 3 + c];
                    img[(y * W + x) * 3 + c] = (byte)(sum / (SS * SS));
                }
        return Png(img, W, H);
    }

    // 8-bit RGB PNG
    public static byte[] Png(byte[] rgb, int w, int h)
    {
        using var raw = new MemoryStream();
        for (int y = 0; y < h; y++) { raw.WriteByte(0); raw.Write(rgb, y * w * 3, w * 3); }
        using var z = new MemoryStream();
        using (var zs = new ZLibStream(z, CompressionLevel.Optimal, true)) raw.WriteTo(zs);

        using var png = new MemoryStream();
        png.Write(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A });
        var ihdr = new byte[13];
        BE(ihdr, 0, (uint)w); BE(ihdr, 4, (uint)h); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
        Chunk(png, "IHDR", ihdr);
        Chunk(png, "IDAT", z.ToArray());
        Chunk(png, "IEND", Array.Empty<byte>());
        return png.ToArray();
    }

    // (width, height) of a PNG, null when it is not one
    public static (int W, int H)? Size(byte[] png)
    {
        if (png.Length < 24 || png[0] != 0x89 || png[1] != 0x50 || png[12] != (byte)'I' || png[13] != (byte)'H') return null;
        int R(int i) => (png[i] << 24) | (png[i + 1] << 16) | (png[i + 2] << 8) | png[i + 3];
        return (R(16), R(20));
    }

    static void BE(byte[] b, int i, uint v) { b[i] = (byte)(v >> 24); b[i + 1] = (byte)(v >> 16); b[i + 2] = (byte)(v >> 8); b[i + 3] = (byte)v; }

    static void Chunk(Stream s, string type, byte[] data)
    {
        var len = new byte[4]; BE(len, 0, (uint)data.Length); s.Write(len);
        var t = System.Text.Encoding.ASCII.GetBytes(type);
        s.Write(t); s.Write(data);
        var crc = new byte[4]; BE(crc, 0, Crc(t, data)); s.Write(crc);
    }

    static uint[]? _table;
    static uint Crc(byte[] a, byte[] b)
    {
        var table = _table ??= Enumerable.Range(0, 256).Select(n =>
        {
            uint c = (uint)n;
            for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            return c;
        }).ToArray();
        uint crc = 0xFFFFFFFFu;
        foreach (var x in a) crc = table[(crc ^ x) & 0xFF] ^ (crc >> 8);
        foreach (var x in b) crc = table[(crc ^ x) & 0xFF] ^ (crc >> 8);
        return crc ^ 0xFFFFFFFFu;
    }
}
