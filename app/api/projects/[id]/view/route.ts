import { NextRequest, NextResponse } from "next/server";
import Project from "@/models/Project";
import connectDB from "@/lib/connect";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const { id } = params;

    // Validate project exists
    const projectExists = await Project.findById(id);
    if (!projectExists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true }
    );

    return NextResponse.json({
      views: project.views,
      message: "View counted",
    });
  } catch (error) {
    console.error("View tracking error:", error);
    return NextResponse.json(
      { error: "Failed to update views" },
      { status: 500 }
    );
  }
}
