class Post {
  final String id;
  final String content;
  final double lat;
  final double lng;
  final DateTime createdAt;
  final String? parentId;
  final int upvotes;
  final int downvotes;
  final int replyCount;

  const Post({
    required this.id,
    required this.content,
    required this.lat,
    required this.lng,
    required this.createdAt,
    this.parentId,
    this.upvotes = 0,
    this.downvotes = 0,
    this.replyCount = 0,
  });

  int get score => upvotes - downvotes;

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['id'] as String,
      content: json['content'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      createdAt: DateTime.parse(json['created_at'] as String),
      parentId: json['parent_id'] as String?,
      upvotes: (json['upvotes'] as num?)?.toInt() ?? 0,
      downvotes: (json['downvotes'] as num?)?.toInt() ?? 0,
      replyCount: (json['reply_count'] as num?)?.toInt() ?? 0,
    );
  }
}
