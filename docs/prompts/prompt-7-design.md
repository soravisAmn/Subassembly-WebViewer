# Round 7 design: Build dialog, report, .atc, source package

Prompt: `prompt-7.md`. This file records the M0 findings and the user's answers.

## 1. Git state at M0

The changes listed in the prompt (shim / generator / fixtures / root files / docs / `tests-civil3d`) were committed before M0 as `a994471` (shape points compared by position) and `206c58c` (prompt-7 + idea list), and pushed. `br.cs`, `body.cs` and `TEST.assembly.json` were deleted at the user's request. The working tree was clean at the start of M0, and `test-all.bat` passed (485 tests).

## 2. Answers to section 10

The user answered "as proposed" for every question (2026-11-14), with a change to 4.

| # | Question | Answer |
|---|---|---|
| 1 | Entry point | "ไฟล์ ▾" → "Build…" plus a "Build" button on the menu bar |
| 2 | Output folder | `build\<DLL name>\<year>\` next to the project file, git-ignored |
| 3 | Copy-to folder | Optional machine setting, default off (the user sets `D:\test_cad\C3D_Custom\SA`) |
| 4 | Same-name DLL elsewhere | **Changed by the user:** a confirm box like the one Windows shows when a file already exists ("do you want to replace"), with **OK / Cancel**. See below |
| 5 | Namespace / class edits | Web-generated files only, confirm + Save (.cs); hand-written files read-only |
| 6 | Default namespace | Keep `TestSubassembly` |
| 7 | MCP `sa_build_check` | Yes, read-only (runs the pre-build checks, never builds) |
| 8 | Icon size | As in section 3.5: render to fit 256×256, declare 64×64; category image = first class's icon, declared 93×123 |
| 9 | .atc files (added in M0) | Two files like the stock catalogs: `<DLL>.atc` (Catalog) → `<DLL>_tools.atc` (Category with the tools) |

**Answer 4 in detail.** When "Build" is pressed and a DLL with the same name is found in another known folder (previous output folders, the Copy-to folder, paths in the manifest), a modal confirm box appears before the build starts, styled like a file-replace prompt:

- Title: "มี DLL ชื่อนี้อยู่แล้ว"
- Text: "`<DLL>.dll` มีอยู่แล้วที่: <list of folders>. ถ้า Civil 3D เคยโหลดตัวนั้นไปแล้วใน session นี้ จะโหลดตัวใหม่จากโฟลเดอร์อื่นไม่ได้ (subassembly .Net classes could not be found). ต้องการ build ทับต่อไหม?" plus a hint: "ปิด Civil 3D ก่อน หรือใช้โฟลเดอร์ Copy-to เดียวกันเสมอ"
- **OK**: the build continues (the same folder's DLL is overwritten as usual). Other folders are only listed, never deleted.
- **Cancel**: the build does not start, and the dialog stays open.
- The pre-build check list still shows it as a warning. It no longer needs the "เข้าใจแล้ว" tick.
- `sa_build_check` reports it as a warning.

## 3. Stock .atc findings

Read only. Nothing from Autodesk is copied into the repo; our template is written from this outline.

### 3.1 Sources

- **Stock .NET subassembly tools:** `C:\ProgramData\Autodesk\C3D 2027\enu\Tool Catalogs\Road Catalog\C3D Metric Basic Subassembly Catalog.atc` (BasicLane around line 192). Its names and descriptions are resource IDs into `AeccStockSubassemblyScriptsRC.dll`, so this file cannot be used as the template for text.
- **Catalog wrapper:** `...\Road Catalog\Autodesk Civil 3D Metric Corridor Catalog.atc`. The root is `<Catalog>`, which lists categories via `<Url href=".\\<file>.atc"/>`.
- **Literal-text tools (the best template):** `C:\ProgramData\Autodesk\C3D 2027\enu\XamlSubassemblies\Metric\Dual_RailPlatform\<guid>.atc` (SAC-style). It uses plain-text `ItemName` / `Description` / `DisplayName`, a **bare DLL file name** (`Assembly="<guid>.dll"`, DLL in the same folder) and a bare image name. Its root is `<Category>`, and no stock `<Catalog>` references it.

### 3.2 Tool block outline (our template)

```
<Tool>                                   (XAML catalogs also add Name="<Class>")
  <ItemID idValue="{guid}"/>
  <Properties>
    <ItemName>Display name</ItemName>
    <Images><Image cx="64" cy="64" src="icons\<Class>.png"/></Images>
    <Description>text</Description>
    <Keywords>…</Keywords>                (optional)
    <Time createdUniversalDateTime=… modifiedUniversalDateTime=…/>
  </Properties>
  <Source/>
  <StockToolRef idValue="{7F55AAC0-0256-48D7-BFA5-914702663FDE}"/>   (same constant in every subassembly tool)
  <Data>
    <AeccDbSubassembly>
      <GeometryGenerateMode>UseDotNet</GeometryGenerateMode>
      <DotNetClass Assembly="<DLL>.dll">Namespace.Class</DotNetClass>
      <Params>
        <Name DataType="Double" TypeInfo="16" DisplayName="…" Description="…">default</Name>
        <Side DataType="Long" DisplayName="…" Description="…">0
          <Enum><Right DisplayName="Right">0</Right><Left DisplayName="Left">1</Left></Enum>
        </Side>
      </Params>
    </AeccDbSubassembly>
    <Units>m</Units>
  </Data>
</Tool>
```

- No `<Resource Module=…/>` line: it is only needed for resource-ID text.
- `DataType`: stock files use only `Double` / `Long` / `String` (capitalised), and XAML files write them in lower case. We use the capitalised form. Bool parameters: check how `GetInputParameters` types map in M1 (stock booleans are `Long` + Yes/No `Enum`).
- `TypeInfo` values seen in stock files: 16 = distance (widths, depths), 9 = slope as % / grade (e.g. `-0.02`), 10 = slope as ratio, 14 = angle (Deflection), 17 = mostly barrier dimensions, 0 = plain number / count, 2 and 3 = integer counts. The mapping from our param `kind` is settled in M3 from the `ParamXxxType` the generator writes.
- `Enum` child element names must be valid XML names (the label goes in `DisplayName`). For options whose label is not a valid name, we generate `Option1…n` as the element name.

### 3.3 Files and structure we generate

Mirror the stock pair, which is known to work with Content Browser "Add Catalog":
- `<DLL>.atc`: root `<Catalog>`, one `<Category>` with `<Url href=".\\<DLL>_tools.atc"/>`.
- `<DLL>_tools.atc`: root `<Category>`, one `<Tool>` per class, in DLL order.

Whether a single-file `<Category>` root (XAML style) works with Add Catalog is unknown. That is not needed this round.

### 3.4 IDs and DLL path

- GUIDs are stable: name-based UUID (SHA-1, v5 style) of `SA-Studio|catalog|<DLL>`, `…|category|<DLL>`, `…|tool|<DLL>|<Namespace.Class>`.
- DLL path: the bare file name `Assembly="<DLL>.dll"` (the XAML catalogs do this; the DLL sits next to the `.atc`). Test it in M5. Fallback build option "path แบบเต็ม" writes the absolute path of the Copy-to / output folder.

### 3.5 Images

- Tools declare `cx="64" cy="64"`, but the stock PNGs are much larger (e.g. AeccBasicLane.png 295×148, AeccBasicCurb.png 160×143, AeccBasicBarrier.png 293×238; RGBA). Civil 3D scales them.
- Category image: `cx="93" cy="123"` (AeccBasicSubassemblies.png is 250×150).
- Proposal: render each class to fit **256×256**, keep the aspect ratio, crop, white background, and declare `cx="64" cy="64"`. Category image: the first class's icon, declared 93×123.

## 4. Build environment found

- `C:\Program Files\Autodesk\AutoCAD 2027` has `C3D\AeccDbMgd.dll`, and `acdbmgd.runtimeconfig.json` has `"tfm": "net10.0"`, which gives `net10.0-windows`.
- `C:\Program Files\Autodesk\AutoCAD 2022` exists without `C3D\`, so it is listed as "ไม่ได้ติดตั้ง Civil 3D". Years before 2025 (.NET Framework) are not supported this round.
- `dotnet --list-sdks`: 10.0.401 only. For 2025 / 2026 (`net8.0-windows`) the SDK 10 can build net8 targets; the check therefore means "an SDK whose major version is at least the TFM major".
- Base settings come from `tests-civil3d/build/Round6.csproj`: x64, `EnableDynamicLoading`, `UseWindowsForms` + `UseWPF`, `EnableDefaultCompileItems=false`, Autodesk references with `Private=false` (acdbmgd, accoremgd, acmgd, ACA\AecBaseMgd, C3D\AeccDbMgd), and the `C3DInstall` override property.

## 5. Output folder layout

```
<project folder>\build\<DLL>\<year>\
  <DLL>.dll
  <DLL>.atc            catalog wrapper
  <DLL>_tools.atc      category with the tools
  icons\<Class>.png
  report.md
  build.log
  build-manifest.json  classes, parameters (name/type/default), DLL path(s) copied to, build time
  obj\                 generated .csproj + intermediate files (not copied)
```

- The path is built in one function (`BuildPaths`), so round 8 (project folders) only changes that function.
- The Copy-to folder receives the `.dll`, both `.atc` files and `icons\` only.
- The machine setting (Copy-to folder) is stored in a local settings file outside the project, e.g. `%LOCALAPPDATA%\SA-Studio\settings.json`, so it is never committed.
- `.gitignore`: add `build/`.

## 6. M1 notes

- Engine in `SA.Web/Build/`, documented in `docs/build.md`. Endpoints: `GET /api/build/versions`, `POST /api/build/plan`, `POST /api/build`.
- The generated `.csproj` lives in `<out>\obj\` (its own intermediate files go to `obj\obj\`). `dotnet build` runs with `-nodeReuse:false`, `ImportDirectoryBuildProps/Targets=false` (no `Directory.Build.*` from parent folders) and English CLI messages.
- Same-name DLL (answer 4): the engine returns status `same-name` with the paths. The dialog shows the OK / Cancel box, and OK resends with `allowSameName: true`. Candidates come from `%LOCALAPPDATA%\SA-Studio\build-history.json` (every DLL built, same Civil 3D year only) plus the Copy-to folder (M4). The folders this build writes to are excluded.
- `.gitignore`: `/build/` (root only). `build/` would also hide new files in the tracked `tests-civil3d/build/`. Round 8 (projects in folders) must widen it.
- A subassembly class = top-level, non-static, with `Draw()` without parameters. The generated `SaDrawing_*` static helper is not a class of the DLL.
- Open for M4: Copy-to with several Civil 3D years ticked would overwrite one DLL with another. Proposal: Copy-to only for one year at a time, or `<Copy-to>\<year>\`.

## 7. M2 notes

- The pre-build checks run on the **server** (`BuildEngine.Check`) on the files on disk, not in the page. One implementation serves the dialog and MCP `sa_build_check`, and it covers hand-written files too. The page only adds its saved scenarios and the "not saved (.cs)" warning.
- Namespace / class rename (answer 5): the whole file cannot be regenerated, because real files differ from `GenerateFile` outside SA-DRAWING (e.g. the header comment keeps the old parameter list). So `CodeGenerator.RenameClass` renames Roslyn tokens instead: identifiers equal to the class name (except namespace parts), the `SaDrawing_` helper, and namespace declarations equal to the old namespace. Then the block is regenerated and `MissingCalls` must be empty. Hand edits inside SA-DRAWING still ask for force, as on a normal Save.
- Logic API: `setClassName(spec, { className?, namespace? })`.
- Same-name box (answer 4): a browser confirm (OK / Cancel) with the paths and the advice.
- Default ticked version: the newest that can be built.
- Project version 2 (`assemblies[].items`) is read too.

## 8. M3 notes

- The Logic API gets `setParamInfo(spec, name, { description?, options? })`. The Parameter card gets "คำอธิบาย" and, for long parameters, "ตัวเลือก" (`0=Right, 1=Left`). The Side parameter defaults to Right / Left (`Spec.paramOptions`, and the same rule on the server).
- Icons are drawn on the **server** from a simulator run (`IconRenderer`), not through `sa_render` in the page: the build runs on the server, the page may be closed, and hand-written files have no spec. Same look as `sa_render` (light blue shapes, dark links, white).
- `TypeInfo`: length 16, slope (x of 1:x) 10, number / percent 0, hand-written 16. Percent is not 9, because 9 stores a grade (0.02) while our percent stores 2.
- The `.atc` is UTF-8 with an XML declaration (Thai descriptions). Check in M5 that Content Browser shows Thai text.
- No `<Time>` elements, so the locked expected files stay stable.
