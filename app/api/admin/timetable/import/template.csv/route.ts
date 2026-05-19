import { NextResponse } from "next/server";
import { withApi } from "@/lib/apiRoute";

const TEMPLATE_HEADERS =
  "ClassCode,Subject,YearGroup,TeacherEmail,DayOfWeek,Period,Room,WeekPattern,StartTime,EndTime";

const EXAMPLE_ROW_1 =
  "10A/Ma1,Mathematics,10,j.smith@school.edu,2,3,B12,A,09:00,10:00";
const EXAMPLE_ROW_2 =
  "10A/En1,English,10,e.jones@school.edu,3,1,A01,A,10:00,11:00";

export const GET = withApi(async function GET() {
  const csv = [TEMPLATE_HEADERS, EXAMPLE_ROW_1, EXAMPLE_ROW_2].join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="timetable-template.csv"',
    },
  });
});
