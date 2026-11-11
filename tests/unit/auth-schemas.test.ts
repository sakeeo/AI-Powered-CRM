import { describe, expect, it } from "vitest";
import { authErrorMessage, safeNextPath, signUpSchema } from "@/modules/auth/schemas";

describe("safeNextPath", () => {
  it("menerima path internal", () => expect(safeNextPath("/leads?x=1")).toBe("/leads?x=1"));
  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "", null, undefined])(
    "menolak %s",
    (v) => expect(safeNextPath(v as string)).toBe("/dashboard"),
  );
});

describe("signUpSchema", () => {
  const base = {
    name: "Budi",
    email: "BUDI@Example.com",
    password: "12345678",
    confirmPassword: "12345678",
  };
  it("menormalkan email", () => expect(signUpSchema.parse(base).email).toBe("budi@example.com"));
  it("menolak password pendek", () =>
    expect(
      signUpSchema.safeParse({ ...base, password: "123", confirmPassword: "123" }).success,
    ).toBe(false));
  it("menolak konfirmasi tidak sama", () =>
    expect(signUpSchema.safeParse({ ...base, confirmPassword: "x" }).success).toBe(false));
});

describe("authErrorMessage", () => {
  it("memetakan kode & 429", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toMatch(/salah/);
    expect(authErrorMessage({ status: 429 })).toMatch(/Terlalu banyak/);
  });
});
