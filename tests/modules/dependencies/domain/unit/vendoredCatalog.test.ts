import { describe, expect, it } from "vitest";

import { isLibraryCopy } from "../../../../../app/modules/dependencies/domain/services/libraryCopies.js";
import { identifyVendored } from "../../../../../app/modules/dependencies/domain/services/vendoredCatalog.js";

describe("isLibraryCopy", () => {
  it("package.json con repository u homepage y no privado", () => {
    expect(isLibraryCopy("package.json", { name: "kendo", repository: { url: "https://github.com/telerik/kendo-ui-core.git" } })).toBe(true);
    expect(isLibraryCopy("package.json", { homepage: "https://x.dev" })).toBe(true);
    expect(isLibraryCopy("package.json", { homepage: "https://x.dev", private: true })).toBe(false);
    expect(isLibraryCopy("package.json", { name: "totoura-sales-reports", private: true })).toBe(false);
    expect(isLibraryCopy("package.json", { name: "app" })).toBe(false);
  });

  it("composer.json con homepage, repositories, support o source y que no es project", () => {
    expect(isLibraryCopy("composer.json", { name: "bcosca/fatfree", homepage: "http://fatfreeframework.com/" })).toBe(true);
    expect(isLibraryCopy("composer.json", { repositories: [] })).toBe(true);
    expect(isLibraryCopy("composer.json", { support: {} })).toBe(true);
    expect(isLibraryCopy("composer.json", { source: {} })).toBe(true);
    expect(isLibraryCopy("composer.json", { homepage: "x", type: "project" })).toBe(false);
    expect(isLibraryCopy("composer.json", { name: "acme/app", require: {} })).toBe(false);
  });
});

describe("identifyVendored", () => {
  const head = (banner: string) => `/*! ${banner} | license */\n(function(){})();`;

  it.each([
    ["kendo.all.min.js", head("Kendo UI v2019.3.1023 (http://www.telerik.com/kendo-ui)"), "npm", "kendo-ui-core", "2019.3.1023"],
    ["kendo.new.min.js", head("Kendo UI v2023.12.1205"), "npm", "kendo-ui-core", "2023.12.1205"],
    ["touch.js", head("jQuery UI Touch Punch 0.2.2"), "npm", "jquery-ui-touch-punch", "0.2.2"],
    ["ui.js", head("jQuery UI 1.8.7"), "npm", "jquery-ui", "1.8.7"],
    ["ui.css", head("jQuery UI CSS Framework 1.8.16"), "npm", "jquery-ui", "1.8.16"],
    ["tabs.js", head("jQuery UI Tabs 1.8.16"), "npm", "jquery-ui", "1.8.16"],
    ["ui2.js", head("jQuery UI - v1.9.0 - 2012-10-05"), "npm", "jquery-ui", "1.9.0"],
    ["m.js", head("jQuery Mobile Framework 1.1.1"), "npm", "jquery-mobile", "1.1.1"],
    ["m2.js", head("jQuery Mobile v1.4.5"), "npm", "jquery-mobile", "1.4.5"],
    ["val.js", head("jQuery Validation Plugin 1.9.0"), "npm", "jquery-validation", "1.9.0"],
    ["jq.js", head("jQuery JavaScript Library v1.5.2"), "npm", "jquery", "1.5.2"],
    ["jq2.js", head("jQuery v1.7.1 jquery.com"), "npm", "jquery", "1.7.1"],
    ["jq3.js", head("jQuery 1.1.2 - New Wave Javascript"), "npm", "jquery", "1.1.2"],
    ["b.css", head("Bootstrap v3.3.5 (http://getbootstrap.com)"), "npm", "bootstrap", "3.3.5"],
    ["fa.css", head("Font Awesome 4.6.3 by @davegandy"), "npm", "font-awesome", "4.6.3"],
    ["sw.js", head("Swiper 3.3.1"), "npm", "swiper", "3.3.1"],
    ["fc.js", head("FullCalendar v1.5.2"), "npm", "fullcalendar", "1.5.2"],
    ["mz.js", head("Modernizr 2.7.1 (Custom Build)"), "npm", "modernizr", "2.7.1"],
    ["mz2.js", head("Modernizr v2.8.3"), "npm", "modernizr", "2.8.3"],
    ["n.css", head("normalize.css v3.0.3 | MIT License"), "npm", "normalize.css", "3.0.3"],
    ["sf.js", head("Superfish v1.4.8 - jQuery menu widget"), "npm", "superfish", "1.4.8"],
  ])("%s", (fileName, text, ecosystem, name, version) => {
    expect(identifyVendored(fileName, text)).toEqual({ ecosystem, name, version });
  });

  it("librerias PHP por nombre de archivo y contenido", () => {
    expect(identifyVendored("PHPExcel.php", "<?php\n/**\n * @version    1.7.8, 2012-10-12\n */")).toEqual({ ecosystem: "composer", name: "phpoffice/phpexcel", version: "1.7.8" });
    expect(identifyVendored("PHPMailer.php", `<?php\nclass PHPMailer {\n${"x\n".repeat(800)}    const VERSION = '6.6.0';\n}`)).toEqual({ ecosystem: "composer", name: "phpmailer/phpmailer", version: "6.6.0" });
    expect(identifyVendored("class.phpmailer.php", `<?php class PHPMailer { public $Version = '5.2.9'; }`)).toEqual({ ecosystem: "composer", name: "phpmailer/phpmailer", version: "5.2.9" });
    expect(identifyVendored("base.php", `<?php final class Base { const\n\t\tPACKAGE='Fat-Free Framework',\n\t\tVERSION='3.5.1-Release'; }`)).toEqual({ ecosystem: "composer", name: "bcosca/fatfree", version: "3.5.1" });
  });

  it("no confunde plugins, nombres de archivo ni firmas fuera de la cabecera o de su tipo", () => {
    expect(identifyVendored("spinner.js", head("jQuery UI Spinner 1.20"))).toBeNull();
    expect(identifyVendored("tools.js", head("jQuery Tools v1.2.6"))).toBeNull();
    expect(identifyVendored("loc.js", head("Localisation assistance for jQuery v1.0.4."))).toBeNull();
    expect(identifyVendored("late.js", `${"x".repeat(1100)} jQuery v1.7.1`)).toBeNull();
    expect(identifyVendored("jq.php", head("jQuery v1.7.1"))).toBeNull();
    expect(identifyVendored("Other.php", "<?php /** @version 1.7.8 */")).toBeNull();
    expect(identifyVendored("PHPExcel.php", "<?php /** sin version */")).toBeNull();
    expect(identifyVendored("base.php", "<?php const VERSION='1.0.0';")).toBeNull();
    expect(identifyVendored("app.js", "console.log('hola')")).toBeNull();
    expect(identifyVendored("jq.json", head("jQuery v1.7.1"))).toBeNull();
    const phpExcel = "<?php /** @version 1.7.8 */";
    expect(identifyVendored("MyPHPExcel.php", phpExcel)).toBeNull();
    expect(identifyVendored("PHPExcel.php.bak", phpExcel)).toBeNull();
    const mailer = "<?php const VERSION = '6.6.0';";
    expect(identifyVendored("NotPHPMailer.php", mailer)).toBeNull();
    expect(identifyVendored("PHPMailer.php.orig", mailer)).toBeNull();
    const fatfree = "<?php const PACKAGE='Fat-Free Framework', VERSION='3.5.1';";
    expect(identifyVendored("database.php", fatfree)).toBeNull();
    expect(identifyVendored("base.php.orig", fatfree)).toBeNull();
  });
});
