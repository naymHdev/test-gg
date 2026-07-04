const calcRatingStats = (feedbacks: { rating: number }[]) => {
  if (!feedbacks || feedbacks.length === 0) {
    return { avgRating: null, ratingCount: 0 };
  }

  const total = feedbacks.reduce((sum, f) => sum + f.rating, 0);

  return {
    avgRating: parseFloat((total / feedbacks.length).toFixed(1)),
    ratingCount: feedbacks.length,
  };
};

export const formatBookingsForCard = (bookings: any[]) => {
  return bookings.map((b) => {
    const isVenue = !!b.venueId;
    const content = isVenue ? b.venue : b.event;
    const { avgRating, ratingCount } = calcRatingStats(
      content?.feedbacks ?? [],
    );

    return {
      id: b.id,

      venueId: b.venueId || null,
      eventId: b.eventId || null,

      status: b.status,
      name: content?.name,
      price: content?.price,
      image: content?.images?.[0] ?? null,
      location: content?.location,
      time: isVenue ? b.eventDate : b.createdAt,
      type: isVenue ? "VENUE" : "EVENT",

      rating: b.rating,
      avgRating,
      ratingCount,
    };
  });
};
