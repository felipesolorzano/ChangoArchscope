import type { AuditGraphProvider } from "../../application/contracts/AuditGraphProvider";
import { HttpAuditGraphProvider } from "../api/HttpAuditGraphProvider";

export interface AuditExplorerDependencies {
  graphProvider: AuditGraphProvider;
}

export function createAuditExplorerDependencies({ graphUrl }: { graphUrl: string }): AuditExplorerDependencies {
  return {
    graphProvider: new HttpAuditGraphProvider(graphUrl),
  };
}
