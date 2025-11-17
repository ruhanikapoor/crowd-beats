// app/api/hello/route.ts

import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Lan lele" }, { status: 200 });
}

export async function POST(req: NextRequest) {
  console.log(req);
  const data = await req.json();
  console.log(data);
  return NextResponse.json(
    {
      message: `Lan name is: ${data.name}, Lan age is: ${data.age} lun email is: ${data.email}`,
    },
    { status: 200 }
  );
}
