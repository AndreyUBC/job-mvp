import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    let email = "";
    let password = "";

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      email = String(body.email ?? "").trim().toLowerCase();
      password = String(body.password ?? "");
    } else {
      const form = await req.formData();
      email = String(form.get("email") ?? "").trim().toLowerCase();
      password = String(form.get("password") ?? "");
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, password: hashed },
    });

    // Auto-login after signup
    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    res.cookies.set("session_user", user.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (e) {
    console.error("Signup error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}