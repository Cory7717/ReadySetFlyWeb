import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertReviewSchema } from "@shared/schema";

type ReviewDialogProps = {
  rentalId: string;
  revieweeId: string;
  revieweeName: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
};

const reviewFormSchema = insertReviewSchema.omit({ reviewerId: true });

export function ReviewDialog({ rentalId, revieweeId, revieweeName, trigger, onSuccess }: ReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [hoveredRating, setHoveredRating] = useState(0);

  const form = useForm<z.infer<typeof reviewFormSchema>>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rentalId,
      revieweeId,
      rating: 5,
      comment: "",
    },
  });

  const createReviewMutation = useMutation({
    mutationFn: async (data: z.infer<typeof reviewFormSchema>) => {
      return await apiRequest("POST", "/api/reviews", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({
        title: "Review submitted",
        description: "Thank you for your feedback!",
      });
      setOpen(false);
      form.reset();
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to submit review",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof reviewFormSchema>) => {
    createReviewMutation.mutate(data);
  };

  const renderStars = (rating: number, isInteractive: boolean = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={!isInteractive}
            onClick={() => isInteractive && form.setValue("rating", star)}
            onMouseEnter={() => isInteractive && setHoveredRating(star)}
            onMouseLeave={() => isInteractive && setHoveredRating(0)}
            className={`${isInteractive ? "cursor-pointer hover:scale-110 transition-transform" : "cursor-default"}`}
            data-testid={`rating-star-${star}`}
          >
            <Star
              className={`h-8 w-8 ${
                star <= (hoveredRating || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  const currentRating = form.watch("rating");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" data-testid="button-open-review">
            Leave a Review
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-review">
        <DialogHeader>
          <DialogTitle>Review {revieweeName}</DialogTitle>
          <DialogDescription>
            Share your experience with this {revieweeName.includes("Rental") ? "rental" : "transaction"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Overall Rating</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      {renderStars(field.value, true)}
                      <p className="text-sm text-muted-foreground">
                        {field.value === 1 && "Poor"}
                        {field.value === 2 && "Fair"}
                        {field.value === 3 && "Good"}
                        {field.value === 4 && "Very Good"}
                        {field.value === 5 && "Excellent"}
                      </p>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="communicationRating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Communication (optional)</FormLabel>
                  <FormControl>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => field.onChange(star)}
                          className="cursor-pointer hover:scale-110 transition-transform"
                          data-testid={`communication-star-${star}`}
                        >
                          <Star
                            className={`h-6 w-6 ${
                              star <= (field.value || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cleanlinessRating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aircraft Condition (optional)</FormLabel>
                  <FormControl>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => field.onChange(star)}
                          className="cursor-pointer hover:scale-110 transition-transform"
                          data-testid={`cleanliness-star-${star}`}
                        >
                          <Star
                            className={`h-6 w-6 ${
                              star <= (field.value || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Share details about your experience..."
                      className="resize-none"
                      rows={4}
                      maxLength={1000}
                      data-testid="input-comment"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-review"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createReviewMutation.isPending}
                data-testid="button-submit-review"
              >
                {createReviewMutation.isPending ? "Submitting..." : "Submit Review"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
