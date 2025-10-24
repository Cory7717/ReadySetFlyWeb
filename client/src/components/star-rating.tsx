import { Star } from "lucide-react";

type StarRatingProps = {
  rating: number;
  totalReviews?: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
};

export function StarRating({ rating, totalReviews, size = "md", showCount = true }: StarRatingProps) {
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const renderStars = () => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Star
            key={i}
            className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`}
            data-testid={`star-filled-${i}`}
          />
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <div key={i} className="relative" data-testid={`star-half-${i}`}>
            <Star className={`${sizeClasses[size]} text-gray-300`} />
            <div className="absolute top-0 left-0 w-1/2 overflow-hidden">
              <Star className={`${sizeClasses[size]} fill-yellow-400 text-yellow-400`} />
            </div>
          </div>
        );
      } else {
        stars.push(
          <Star
            key={i}
            className={`${sizeClasses[size]} text-gray-300`}
            data-testid={`star-empty-${i}`}
          />
        );
      }
    }
    return stars;
  };

  return (
    <div className="flex items-center gap-1" data-testid="star-rating">
      <div className="flex gap-0.5">{renderStars()}</div>
      {showCount && totalReviews !== undefined && (
        <span className="text-sm text-muted-foreground ml-1" data-testid="review-count">
          ({totalReviews})
        </span>
      )}
      {!showCount && (
        <span className="text-sm text-muted-foreground ml-1" data-testid="rating-value">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
