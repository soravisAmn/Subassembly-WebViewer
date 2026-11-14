// How Civil 3D turns Shapes.Add(links) into the filled outline (found in Civil 3D 2027, round 6 M5):
//   it walks the links in array order. The first link keeps its own direction; each next link must touch the
//   current end point (the same point, either end: a reversed link is turned around). A link that does not touch is
//   still appended as it is, so the outline jumps and the fill shows crossed triangles.
// The simulator must not be more lenient than this, so the web shows the same broken fill.

using System.Collections.Generic;
using Autodesk.Civil.Runtime;

namespace SA.Shim
{
    public static class ShapeWalk
    {
        // outline = point sequence of the fill (closed implicitly) · chained = every link touched the previous end and the walk returned to the start
        public static (List<Point> outline, bool chained) Walk(Shape s)
        {
            var outline = new List<Point>();
            bool chained = true;
            foreach (Link l in s.Links)
            {
                var pts = new List<Point>();
                for (int i = 0; i < l.Points.Count; i++) pts.Add(l.Points[i]);
                if (outline.Count == 0) { outline.AddRange(pts); continue; }
                Point end = outline[outline.Count - 1];
                if (Same(pts[0], end)) outline.AddRange(pts.GetRange(1, pts.Count - 1));
                else if (Same(pts[pts.Count - 1], end)) { pts.Reverse(); outline.AddRange(pts.GetRange(1, pts.Count - 1)); }
                else { chained = false; outline.AddRange(pts); }
            }
            if (outline.Count > 1 && Same(outline[0], outline[outline.Count - 1])) outline.RemoveAt(outline.Count - 1);
            else chained = false;
            return (outline, chained);
        }

        // same point of the CorridorState (Point objects are wrappers, never compare them by reference)
        static bool Same(Point a, Point b) => a.Index == b.Index;
    }
}
