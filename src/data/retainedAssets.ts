import type { WorkspaceContext } from './workspaceActions';

export async function withRetainedAssets<T>(context: WorkspaceContext, operation: () => Promise<T>): Promise<T> {
  const release = context.manager().retain();
  try {
    return await operation();
  } finally {
    release(context.get()?.profiles.flatMap((profile) => profile.assets.map((asset) => asset.id)));
  }
}
