import { describe, expect, it, vi } from "vitest";

import { LocalRuntimeProbe } from "../../../../../app/modules/dependencies/infrastructure/runtime/LocalRuntimeProbe.js";

describe("LocalRuntimeProbe", () => {
  it("pregunta a cada binario su version y la normaliza", () => {
    const exec = vi.fn((command: string) => ({ php: "8.3.6", node: "v23.6.0\n", npm: "10.9.2\n" })[command] as string);
    const probe = new LocalRuntimeProbe(exec);

    expect(probe.versionOf("php")).toBe("8.3.6");
    expect(probe.versionOf("node")).toBe("23.6.0");
    expect(probe.versionOf("npm")).toBe("10.9.2");
    expect(exec).toHaveBeenCalledWith("php", ["-r", "echo PHP_VERSION;"]);
    expect(exec).toHaveBeenCalledWith("node", ["-v"]);
    expect(exec).toHaveBeenCalledWith("npm", ["-v"]);
  });

  it("si el binario falla o no responde una version devuelve null", () => {
    const failing = new LocalRuntimeProbe(() => {
      throw new Error("ENOENT");
    });

    expect(failing.versionOf("php")).toBeNull();
    expect(new LocalRuntimeProbe(() => "command not found").versionOf("npm")).toBeNull();
  });

  it("por defecto ejecuta el binario real (node existe en este entorno)", () => {
    expect(new LocalRuntimeProbe().versionOf("node")).toBe(process.versions.node);
  });
});
