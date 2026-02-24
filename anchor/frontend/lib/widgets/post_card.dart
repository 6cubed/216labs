import 'package:flutter/material.dart';
import 'package:timeago/timeago.dart' as timeago;
import '../models/post.dart';

class PostCard extends StatelessWidget {
  final Post post;
  final VoidCallback? onTap;
  final ValueChanged<int>? onVote;

  const PostCard({super.key, required this.post, this.onTap, this.onVote});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(post.content, style: theme.textTheme.bodyLarge),
              const SizedBox(height: 12),
              Row(
                children: [
                  _VoteButton(
                    icon: Icons.arrow_upward_rounded,
                    count: post.upvotes,
                    color: theme.colorScheme.primary,
                    onTap: () => onVote?.call(1),
                  ),
                  const SizedBox(width: 4),
                  _VoteButton(
                    icon: Icons.arrow_downward_rounded,
                    count: post.downvotes,
                    color: theme.colorScheme.error,
                    onTap: () => onVote?.call(-1),
                  ),
                  const Spacer(),
                  if (post.replyCount > 0) ...[
                    Icon(Icons.chat_bubble_outline_rounded,
                        size: 14, color: theme.colorScheme.onSurfaceVariant),
                    const SizedBox(width: 4),
                    Text('${post.replyCount}',
                        style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant)),
                    const SizedBox(width: 12),
                  ],
                  Text(
                    timeago.format(post.createdAt),
                    style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _VoteButton extends StatelessWidget {
  final IconData icon;
  final int count;
  final Color color;
  final VoidCallback onTap;

  const _VoteButton({
    required this.icon,
    required this.count,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        child: Row(
          children: [
            Icon(icon, size: 16, color: color),
            const SizedBox(width: 2),
            Text('$count',
                style: Theme.of(context)
                    .textTheme
                    .labelSmall
                    ?.copyWith(color: color)),
          ],
        ),
      ),
    );
  }
}
