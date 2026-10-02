const HEAD_LENGTH = 1024;
const HEAD_EXTENSIONS = /\.(js|css)$/;
const V = "(\\d+\\.\\d+\\.\\d+)";
// Orden: las firmas mas especificas antes que las genericas (Touch Punch → jQuery UI → jQuery).
const SIGNATURES = [
    { ecosystem: "npm", name: "kendo-ui-core", pattern: /Kendo UI v(\d{4}\.\d+\.\d+)/ },
    { ecosystem: "npm", name: "jquery-ui-touch-punch", pattern: new RegExp(`jQuery UI Touch Punch ${V}`) },
    { ecosystem: "npm", name: "jquery-ui", pattern: new RegExp(`jQuery UI (?:CSS Framework |[A-Z][a-z]+ )?(?:- )?v?${V}`) },
    { ecosystem: "npm", name: "jquery-mobile", pattern: new RegExp(`jQuery Mobile (?:Framework )?v?${V}`) },
    { ecosystem: "npm", name: "jquery-validation", pattern: new RegExp(`jQuery Validation Plugin v?${V}`) },
    // "Time entry for jQuery v1.5.1": la version es del plugin, no de jQuery.
    { ecosystem: "npm", name: "jquery", pattern: new RegExp(`(?<!for )jQuery (?:JavaScript Library )?v?${V}`) },
    { ecosystem: "npm", name: "bootstrap", pattern: new RegExp(`Bootstrap v${V}`) },
    { ecosystem: "npm", name: "font-awesome", pattern: new RegExp(`Font Awesome ${V}`) },
    { ecosystem: "npm", name: "swiper", pattern: new RegExp(`Swiper ${V}`) },
    { ecosystem: "npm", name: "fullcalendar", pattern: new RegExp(`FullCalendar v${V}`) },
    { ecosystem: "npm", name: "modernizr", pattern: new RegExp(`Modernizr v?${V}`) },
    { ecosystem: "npm", name: "normalize.css", pattern: new RegExp(`normalize\\.css v${V}`) },
    { ecosystem: "npm", name: "superfish", pattern: new RegExp(`Superfish v${V}`) },
    { ecosystem: "composer", name: "phpoffice/phpexcel", fileName: /^PHPExcel\.php$/, pattern: new RegExp(`@version\\s+${V}`) },
    { ecosystem: "composer", name: "phpmailer/phpmailer", fileName: /^(PHPMailer|class\.phpmailer)\.php$/, pattern: new RegExp(`(?:VERSION|\\$Version)\\s*=\\s*'${V}`) },
    { ecosystem: "composer", name: "bcosca/fatfree", fileName: /^base\.php$/, pattern: new RegExp(`PACKAGE='Fat-Free Framework',\\s*VERSION='${V}`) },
];
/** Libreria conocida copiada a mano en el archivo, por su cabecera o su nombre + contenido. */
export function identifyVendored(fileName, text) {
    const head = HEAD_EXTENSIONS.test(fileName) ? text.slice(0, HEAD_LENGTH) : null;
    for (const signature of SIGNATURES) {
        const haystack = signature.fileName ? (signature.fileName.test(fileName) ? text : null) : head;
        const match = haystack?.match(signature.pattern);
        if (match) {
            return { ecosystem: signature.ecosystem, name: signature.name, version: match[1] };
        }
    }
    return null;
}
