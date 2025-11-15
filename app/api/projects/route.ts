import { NextRequest, NextResponse } from "next/server";
import Project from "@/models/Project";
import connectDB from "@/lib/connect";

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "12");
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "published";
    const sortBy = searchParams.get("sortBy") || "featured,createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;

    // Build filter object
    const filter: any = { status };
    if (category && category !== "all") {
      filter.category = category;
    }

    // Build sort object
    const sort: any = {};
    const sortFields = sortBy.split(",");
    const sortOrders = sortOrder.split(",");

    sortFields.forEach((field, index) => {
      const order = sortOrders[index] === "desc" ? -1 : 1;
      sort[field] = order;
    });

    const [projects, total] = await Promise.all([
      Project.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Project.countDocuments(filter),
    ]);

    return NextResponse.json({
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create new project
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    // Validate required fields
    const { title, category, description, image } = body;
    if (!title || !category || !description || !image) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const project = new Project(body);
    await project.save();

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
