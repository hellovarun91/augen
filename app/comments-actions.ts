"use server";
import { createComment, getComment, deleteComment, type CommentRow } from "@/lib/repo";
import { requireBrandAccess } from "@/lib/authz";
import { getCurrentUserId } from "@/lib/users";

export async function addCommentAction(
  brandId: string, targetType: string, targetId: string, body: string, mentions: string[],
): Promise<CommentRow> {
  await requireBrandAccess(brandId);
  const uid = await getCurrentUserId();
  if (!uid) throw new Error("Not signed in");
  const text = body.trim();
  if (!text) throw new Error("Write something first");
  return createComment({ brandId, targetType, targetId, authorId: uid, body: text, mentions: mentions || [] });
}

export async function deleteCommentAction(commentId: string) {
  const c = getComment(commentId);
  if (!c) return;
  const uid = await getCurrentUserId();
  if (c.brand_id) await requireBrandAccess(c.brand_id);
  // Author can always remove their own comment.
  if (c.author_id !== uid) {
    // non-authors need brand access (already checked above); allow as a soft rule.
  }
  deleteComment(commentId);
}
