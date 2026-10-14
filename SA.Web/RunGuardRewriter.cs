// แทรก global::SA.Shim.RunGuard.Tick(); ลงในโค้ดของผู้ใช้ก่อนคอมไพล์ (ในหน่วยความจำเท่านั้น)
//   - ต้น body ของ method / constructor / accessor / local function / lambda แบบมีปีกกา
//   - ต้น body ของ while / do / for / foreach
// ข้อความที่แทรกอยู่บรรทัดเดียวกับ { เสมอ เลขบรรทัดจึงไม่เลื่อน (stack trace ตรงกับไฟล์จริง)
// ส่วนเลขคอลัมน์ของ diagnostic แปลงกลับด้วย MapToOriginal

using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.CodeAnalysis.Text;
using static Microsoft.CodeAnalysis.CSharp.SyntaxFactory;

public sealed class GuardedTree
{
    public required SyntaxTree Tree { get; init; }
    public required SourceText Original { get; init; }
    // ช่วงข้อความที่แทรกเพิ่ม (ตำแหน่งในข้อความใหม่) เรียงจากต้นไฟล์
    public required List<TextSpan> Inserted { get; init; }

    // แปลงตำแหน่ง diagnostic ในโค้ดที่แทรกแล้ว กลับเป็นบรรทัด/คอลัมน์ของไฟล์จริง (1-based)
    public (int Line, int Column) MapToOriginal(Location loc)
    {
        if (!loc.IsInSource) return (0, 0);
        int pos = loc.SourceSpan.Start;
        int shift = 0;
        foreach (var s in Inserted)
        {
            if (s.Start >= pos) break;
            shift += Math.Min(s.Length, pos - s.Start);
        }
        int orig = Math.Clamp(pos - shift, 0, Original.Length);
        var lp = Original.Lines.GetLinePosition(orig);
        return (lp.Line + 1, lp.Character + 1);
    }
}

public static class RunGuardRewriter
{
    private static readonly SyntaxAnnotation Mark = new("sa-guard");

    public static GuardedTree Apply(SyntaxTree tree, SourceText text, CSharpParseOptions options)
    {
        // โค้ดที่ parse ไม่ผ่านจะคอมไพล์ไม่ผ่านอยู่แล้ว ไม่ต้องแทรก (error จะได้ชี้ตำแหน่งเดิมพอดี)
        if (tree.GetDiagnostics().Any(d => d.Severity == DiagnosticSeverity.Error))
            return new GuardedTree { Tree = tree, Original = text, Inserted = new() };

        var root = new Rewriter().Visit(tree.GetRoot());
        var inserted = root.GetAnnotatedNodesAndTokens(Mark)
            .Select(n => n.Span)
            .Where(s => s.Length > 0)
            .OrderBy(s => s.Start)
            .ToList();
        var newTree = CSharpSyntaxTree.Create((CSharpSyntaxNode)root, options, tree.FilePath, System.Text.Encoding.UTF8);
        return new GuardedTree { Tree = newTree, Original = text, Inserted = inserted };
    }

    private static StatementSyntax TickStatement() =>
        ParseStatement("global::SA.Shim.RunGuard.Tick();").WithoutTrivia().WithAdditionalAnnotations(Mark);

    // { ...  ->  {Tick(); ...   (ย้าย trivia ท้าย { ไปไว้หลัง Tick เพื่อให้อยู่บรรทัดเดียวกับ {)
    private static BlockSyntax Guard(BlockSyntax block)
    {
        var open = block.OpenBraceToken;
        var tick = TickStatement().WithTrailingTrivia(open.TrailingTrivia);
        return block
            .WithOpenBraceToken(open.WithTrailingTrivia(SyntaxTriviaList.Empty))
            .WithStatements(block.Statements.Insert(0, tick));
    }

    // statement เดี่ยวของ loop:  x++;  ->  {Tick(); x++;}
    private static StatementSyntax GuardBody(StatementSyntax body)
    {
        if (body is BlockSyntax b) return Guard(b);
        var open = Token(SyntaxKind.OpenBraceToken).WithLeadingTrivia(body.GetLeadingTrivia()).WithAdditionalAnnotations(Mark);
        var close = Token(SyntaxKind.CloseBraceToken).WithTrailingTrivia(body.GetTrailingTrivia()).WithAdditionalAnnotations(Mark);
        var inner = body.WithoutLeadingTrivia().WithoutTrailingTrivia();
        return Block(open, List(new[] { TickStatement(), inner }), close);
    }

    private sealed class Rewriter : CSharpSyntaxRewriter
    {
        public override SyntaxNode? VisitMethodDeclaration(MethodDeclarationSyntax node)
        {
            var n = (MethodDeclarationSyntax)base.VisitMethodDeclaration(node)!;
            return n.Body != null ? n.WithBody(Guard(n.Body)) : n;
        }

        public override SyntaxNode? VisitConstructorDeclaration(ConstructorDeclarationSyntax node)
        {
            var n = (ConstructorDeclarationSyntax)base.VisitConstructorDeclaration(node)!;
            return n.Body != null ? n.WithBody(Guard(n.Body)) : n;
        }

        public override SyntaxNode? VisitAccessorDeclaration(AccessorDeclarationSyntax node)
        {
            var n = (AccessorDeclarationSyntax)base.VisitAccessorDeclaration(node)!;
            return n.Body != null ? n.WithBody(Guard(n.Body)) : n;
        }

        public override SyntaxNode? VisitLocalFunctionStatement(LocalFunctionStatementSyntax node)
        {
            var n = (LocalFunctionStatementSyntax)base.VisitLocalFunctionStatement(node)!;
            return n.Body != null ? n.WithBody(Guard(n.Body)) : n;
        }

        public override SyntaxNode? VisitParenthesizedLambdaExpression(ParenthesizedLambdaExpressionSyntax node)
        {
            var n = (ParenthesizedLambdaExpressionSyntax)base.VisitParenthesizedLambdaExpression(node)!;
            return n.Block != null ? n.WithBlock(Guard(n.Block)) : n;
        }

        public override SyntaxNode? VisitSimpleLambdaExpression(SimpleLambdaExpressionSyntax node)
        {
            var n = (SimpleLambdaExpressionSyntax)base.VisitSimpleLambdaExpression(node)!;
            return n.Block != null ? n.WithBlock(Guard(n.Block)) : n;
        }

        public override SyntaxNode? VisitAnonymousMethodExpression(AnonymousMethodExpressionSyntax node)
        {
            var n = (AnonymousMethodExpressionSyntax)base.VisitAnonymousMethodExpression(node)!;
            return n.WithBlock(Guard(n.Block));
        }

        public override SyntaxNode? VisitWhileStatement(WhileStatementSyntax node)
        {
            var n = (WhileStatementSyntax)base.VisitWhileStatement(node)!;
            return n.WithStatement(GuardBody(n.Statement));
        }

        public override SyntaxNode? VisitDoStatement(DoStatementSyntax node)
        {
            var n = (DoStatementSyntax)base.VisitDoStatement(node)!;
            return n.WithStatement(GuardBody(n.Statement));
        }

        public override SyntaxNode? VisitForStatement(ForStatementSyntax node)
        {
            var n = (ForStatementSyntax)base.VisitForStatement(node)!;
            return n.WithStatement(GuardBody(n.Statement));
        }

        public override SyntaxNode? VisitForEachStatement(ForEachStatementSyntax node)
        {
            var n = (ForEachStatementSyntax)base.VisitForEachStatement(node)!;
            return n.WithStatement(GuardBody(n.Statement));
        }

        public override SyntaxNode? VisitForEachVariableStatement(ForEachVariableStatementSyntax node)
        {
            var n = (ForEachVariableStatementSyntax)base.VisitForEachVariableStatement(node)!;
            return n.WithStatement(GuardBody(n.Statement));
        }
    }
}
