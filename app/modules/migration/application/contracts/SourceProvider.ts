export type ProjectSource = {
  target: string;
  root: string;
  extensions: string[];
  ignoredPaths: string[];
  files: string[];
};

// Le dice al agente DONDE esta el proyecto a analizar y QUE archivos estan en alcance, para
// que pueda leerlos y proponer los bounded contexts. La composition root la implementa con la
// config + el SourceTreeReader.
export interface SourceProvider {
  getSource(target: string): ProjectSource;
}
