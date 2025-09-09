
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import type { ActionDoc } from "@/types/actions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
  const things = await db.collection<ActionDoc>("things")
    .find({ tenantId, enabled: true })
    .project({ _id: 0 })
    .toArray();
  return NextResponse.json(things);
}
