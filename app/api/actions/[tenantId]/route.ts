// app/api/actions/[tenantId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import getMongoConnection from "@/db/connections";
import type { ActionDoc } from "@/types/actions";

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { db } = await getMongoConnection(process.env.DB!, process.env.MAINDBNAME!);
  const actions = await db.collection<ActionDoc>("actions")
    .find({ tenantId, enabled: true })
    .project({ _id: 0 }) // excludes _id field from return
    .toArray();
  return NextResponse.json(actions);
}
