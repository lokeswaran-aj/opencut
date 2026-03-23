// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"agents.mdx": () => import("../content/agents.mdx?collection=docs"), "api.mdx": () => import("../content/api.mdx?collection=docs"), "architecture.mdx": () => import("../content/architecture.mdx?collection=docs"), "database.mdx": () => import("../content/database.mdx?collection=docs"), "techstack.mdx": () => import("../content/techstack.mdx?collection=docs"), }),
};
export default browserCollections;