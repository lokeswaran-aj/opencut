// @ts-nocheck
import * as __fd_glob_4 from "../content/techstack.mdx?collection=docs"
import * as __fd_glob_3 from "../content/database.mdx?collection=docs"
import * as __fd_glob_2 from "../content/architecture.mdx?collection=docs"
import * as __fd_glob_1 from "../content/api.mdx?collection=docs"
import * as __fd_glob_0 from "../content/agents.mdx?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content", {}, {"agents.mdx": __fd_glob_0, "api.mdx": __fd_glob_1, "architecture.mdx": __fd_glob_2, "database.mdx": __fd_glob_3, "techstack.mdx": __fd_glob_4, });