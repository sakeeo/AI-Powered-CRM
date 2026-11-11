import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "@/lib/logger";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, stream };
}

describe("logger", () => {
  it("menyamarkan field sensitif", () => {
    const { lines, stream } = capture();
    const log = createLogger(stream);
    log.level = "info";
    log.info(
      {
        password: "rahasia123",
        user: { token: "tok-abc", name: "Budi" },
        headers: { authorization: "Bearer xyz", cookie: "sid=1" },
        apiKey: "sk-live-123",
      },
      "login",
    );
    const out = lines.join("");
    for (const secret of ["rahasia123", "tok-abc", "Bearer xyz", "sid=1", "sk-live-123"]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain("[REDACTED]");
    expect(out).toContain("Budi");
  });

  it("keluaran berupa JSON dengan service", () => {
    const { lines, stream } = capture();
    const log = createLogger(stream);
    log.level = "info";
    log.info("halo");
    expect(JSON.parse(lines[0])).toMatchObject({ service: "crm", msg: "halo" });
  });
});
