using System.Collections.Generic;

namespace SA.Core
{
    // จุดในพิกัดของ subassembly: U = ระยะออกด้านนอก (ก่อน flip), Y = ระดับเทียบกับ origin
    public struct Vertex
    {
        public double U;
        public double Y;
        public string PointCode;
        public string[] LinkCodes; // code ของ link จากจุดนี้ไปจุดถัดไป

        public Vertex(double u, double y, string pointCode, params string[] linkCodes)
        {
            U = u;
            Y = y;
            PointCode = pointCode;
            LinkCodes = linkCodes;
        }
    }

    // ผิว surface ในพิกัด U/Y ของ subassembly
    //   - Civil 3D : อ่านจาก TIN surface จริง (SA.Civil3D/Civil3DGround.cs)
    //   - เว็บ/test: เส้นหักที่ผู้ใช้กำหนดเอง (PolylineGround)
    public interface IGround
    {
        // ระดับ surface (เทียบกับ origin) ที่ระยะ u
        double ElevationAt(double u);

        // ลากเส้นจากจุด from ไปทาง dir (+1/-1 ในแกน U) ด้วย slope จนชน surface
        Vertex IntersectFrom(Vertex from, double dir, double slope, string pointCode);

        // จุดบนผิว surface ระหว่าง u1 ถึง u2 เรียงตาม U (รวมปลายทั้งสอง)
        List<(double U, double Y)> Profile(double u1, double u2);
    }
}
