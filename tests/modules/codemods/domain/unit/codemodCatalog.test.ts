import { describe, expect, it } from "vitest";

import { CODEMOD_CATALOG } from "../../../../../app/modules/codemods/domain/services/codemodCatalog.js";

const RECTOR = "vendor/bin/rector process {paths} --dry-run";

describe("CODEMOD_CATALOG (XRay X5)", () => {
  it("recetas de react", () => {
    expect(Object.fromEntries(Object.entries(CODEMOD_CATALOG).filter(([, recipe]) => recipe.stack === "react"))).toEqual({
      "unsafe-lifecycles": {
        stack: "react",
        title: "Lifecycles deprecados (componentWillMount/ReceiveProps/Update)",
        tool: "react-codemod",
        command: "npx react-codemod rename-unsafe-lifecycles {paths}",
        note: "Solo renombra a UNSAFE_*: pasarlos a componentDidMount / getDerivedStateFromProps / componentDidUpdate sigue siendo manual.",
      },
      "react-dom-render": {
        stack: "react",
        title: "ReactDOM.render / hydrate → createRoot",
        tool: "codemod",
        command: "npx codemod@latest react/19/replace-reactdom-render",
        note: "Correr en la raiz del proyecto (React 18+).",
      },
      "string-refs": { stack: "react", title: "String refs → createRef", tool: "codemod", command: "npx codemod@latest react/19/replace-string-ref", note: "Correr en la raiz del proyecto." },
      "find-dom-node": { stack: "react", title: "findDOMNode → ref", tool: null, command: null, note: "Pasar una ref al elemento y usar ref.current." },
      "with-router": {
        stack: "react",
        title: "withRouter → hooks de React Router v6",
        tool: null,
        command: null,
        note: "useNavigate / useLocation / useParams; los componentes de clase necesitan un wrapper funcion o pasar a funcion.",
      },
      jquery: { stack: "react", title: "jQuery → DOM nativo / estado de React", tool: null, command: null, note: "Reemplazar selectores y efectos por refs/estado; $.ajax por fetch." },
      "lib-moment": { stack: "react", title: "moment → date-fns / dayjs", tool: null, command: null, note: "Mantenimiento finalizado; revisar formatos y locales." },
      "lib-request": { stack: "react", title: "request → fetch / axios", tool: null, command: null, note: "Libreria deprecada." },
      "lib-react-ga": { stack: "react", title: "react-ga → react-ga4", tool: null, command: null, note: "Universal Analytics ya no recibe datos." },
    });
  });

  it("recetas de laravel", () => {
    expect(Object.fromEntries(Object.entries(CODEMOD_CATALOG).filter(([, recipe]) => recipe.stack === "laravel"))).toEqual({
      ereg: { stack: "laravel", title: "ereg / split → preg_*", tool: "rector", command: RECTOR, note: "Regla EregToPregMatchRector (PHP 7.0)." },
      each: {
        stack: "laravel",
        title: "each() → foreach",
        tool: "rector",
        command: RECTOR,
        note: "Reglas WhileEachToForeachRector y ListEachRector (PHP 7.2); otros usos de each() son manuales.",
      },
      "create-function": { stack: "laravel", title: "create_function → closure", tool: "rector", command: RECTOR, note: "Regla CreateFunctionToClosureRector (PHP 7.2)." },
      "utf8-encode": {
        stack: "laravel",
        title: "utf8_encode / utf8_decode → mb_convert_encoding",
        tool: "rector",
        command: RECTOR,
        note: "Regla Utf8DecodeEncodeToMbConvertEncodingRector (PHP 8.2).",
      },
      mysql: { stack: "laravel", title: "mysql_* → mysqli / PDO", tool: null, command: null, note: "Cambia el manejo de conexion y errores: migracion manual." },
      mcrypt: { stack: "laravel", title: "mcrypt → openssl", tool: null, command: null, note: "Verificar que lo cifrado antes se pueda descifrar despues." },
      "money-format": { stack: "laravel", title: "money_format → NumberFormatter", tool: null, command: null, note: "" },
      "magic-quotes": { stack: "laravel", title: "magic quotes → quitar", tool: null, command: null, note: "Devuelven false desde PHP 5.4: el codigo que depende de ellas es muerto." },
    });
  });
});
