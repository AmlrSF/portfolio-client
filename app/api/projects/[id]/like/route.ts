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
    const { liked } = await request.json();

    // Validate project exists
    const projectExists = await Project.findById(id);
    if (!projectExists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = await Project.findByIdAndUpdate(
      id,
      { $inc: { likes: liked ? 1 : -1 } },
      { new: true }
    );

    return NextResponse.json({
      likes: project.likes,
      message: liked ? "Project liked" : "Project unliked",
    });
  } catch (error) {
    console.error("Like error:", error);
    return NextResponse.json(
      { error: "Failed to update likes" },
      { status: 500 }
    );
  }
}
