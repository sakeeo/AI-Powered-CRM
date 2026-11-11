import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { setErrorReporter } from "@/lib/error-tracking";
import { AppError, handleRouteError, NotFoundError } from "@/lib/errors";

describe("handleRouteError", () => {
  it("AppError → status & kode sesuai", async () => {
    const res = handleRouteError(NotFoundError("Lead"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toEqual({
      code: "not_found",
      message: "Lead tidak ditemukan",
    });
  });

  it("ZodError → 422 dengan issues", async () => {
    const err = z.object({ a: z.string() }).safeParse({}).error!;
    const res = handleRouteError(err);
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("validation_error");
  });

  it("error tak terduga → 500 disamarkan dan dilaporkan", async () => {
    const reporter = vi.fn();
    setErrorReporter(reporter);
    const res = handleRouteError(new Error("db password=abc bocor"), { route: "x" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("bocor");
    expect(reporter).toHaveBeenCalledOnce();
  });

  it("AppError kustom dihormati", () => {
    expect(handleRouteError(new AppError("x", 409, "conflict")).status).toBe(409);
  });
});
