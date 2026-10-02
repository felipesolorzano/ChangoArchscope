import { describe, expect, it, vi } from "vitest";

import { detectVendoredLibraries } from "../../../../../app/modules/dependencies/application/use-cases/detectVendoredLibraries.js";
import type { SourceTreeReader } from "../../../../../app/modules/shared/domain/repositories/SourceTreeReader.js";

const files: Record<string, string> = {
  "/mc/admin/js/jquery-1.7.1.min.js": "/*! jQuery v1.7.1 jquery.com */",
  "/mc/provider/js/jquery-1.7.1.min.js": "/*! jQuery v1.7.1 jquery.com */",
  "/mc/web/js/jquery.js": "/*! jQuery JavaScript Library v1.10.2 */",
  "/mc/web/js/old.js": "/*! jQuery JavaScript Library v1.5.2 */",
  "/mc/admin/xls/Classes/PHPExcel.php": "<?php /** @version 1.7.8, 2012 */",
  "/mc/admin/app.js": "console.log(1)",
};

function reader(): SourceTreeReader {
  return { listDirectories: () => [], walkFiles: vi.fn(() => Object.keys(files)), readText: (file) => files[file], isFile: () => true };
}

describe("detectVendoredLibraries", () => {
  it("una dependencia por libreria y version, con la cantidad de copias, ordenadas por nombre y version", () => {
    const fs = reader();

    expect(detectVendoredLibraries({ root: "/mc", ignoredPaths: ["legacy/**"], reader: fs })).toEqual([
      { ecosystem: "npm", name: "jquery", constraint: "1.5.2", installed: "1.5.2", dev: false, manifest: "/mc/web/js/old.js", vendored: { files: 1 } },
      { ecosystem: "npm", name: "jquery", constraint: "1.7.1", installed: "1.7.1", dev: false, manifest: "/mc/admin/js/jquery-1.7.1.min.js", vendored: { files: 2 } },
      { ecosystem: "npm", name: "jquery", constraint: "1.10.2", installed: "1.10.2", dev: false, manifest: "/mc/web/js/jquery.js", vendored: { files: 1 } },
      { ecosystem: "composer", name: "phpoffice/phpexcel", constraint: "1.7.8", installed: "1.7.8", dev: false, manifest: "/mc/admin/xls/Classes/PHPExcel.php", vendored: { files: 1 } },
    ]);
    expect(fs.walkFiles).toHaveBeenCalledWith("/mc", [".js", ".css", ".php", ".inc"], ["legacy/**", "**/node_modules", "**/vendor", "**/.*"]);
  });
});
