"use client";

import React, { useState, useEffect } from 'react';

// Define the structure of an advertisement
interface Advertisement {
  id: number;
  imageUrl: string;
  linkUrl?: string;
  altText: string;
}

// Sample advertisements (replace with actual images)
const defaultAdvertisements: Advertisement[] = [
  {
    id: 1,
    imageUrl: '/images/ads/Screenshot 2024-12-20 194900.png',
    linkUrl: 'https://example.com/promo1',
    altText: 'First Promotional Offer'
  },
  {
    id: 2,
    imageUrl: '/images/ads/Screenshot 2024-12-21 163809.png',
    linkUrl: 'https://example.com/promo2',
    altText: 'Second Promotional Offer'
  },
  {
    id: 3,
    imageUrl: '/images/ads/Screenshot 2024-12-23 221918.png',
    linkUrl: 'https://example.com/promo3',
    altText: 'Third Promotional Offer'
  }
];

interface AdvertisementCarouselProps {
  ads?: Advertisement[];
  autoSlideInterval?: number;
}

const AdvertisementCarousel: React.FC<AdvertisementCarouselProps> = ({ 
  ads = defaultAdvertisements, 
  autoSlideInterval = 5000 
}) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  useEffect(() => {
    // Auto-slide logic
    const slideTimer = setInterval(() => {
      setCurrentAdIndex((prevIndex) => 
        (prevIndex + 1) % ads.length
      );
    }, autoSlideInterval);

    // Cleanup interval on component unmount
    return () => clearInterval(slideTimer);
  }, [ads.length, autoSlideInterval]);

  const handleAdClick = (linkUrl?: string) => {
    if (linkUrl) {
      window.open(linkUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDotClick = (index: number) => {
    setCurrentAdIndex(index);
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto group border-2 border-purple-700/30 rounded-xl bg-black/10 h-[200px] p-0">
      {/* Advertisement Image */}
      <div className="relative overflow-hidden rounded-lg shadow-lg h-full w-full">
        {ads.map((ad, index) => (
          <div
            key={ad.id}
            className={`
              absolute top-0 left-0 w-full h-full transition-opacity duration-500 ease-in-out
              ${index === currentAdIndex ? 'opacity-100' : 'opacity-0'}
            `}
          >
            <img
              src={ad.imageUrl}
              alt={ad.altText}
              onClick={() => handleAdClick(ad.linkUrl)}
              className="absolute top-0 left-0 w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity rounded-none"
            />
          </div>
        ))}
      </div>

      {/* Navigation Dots */}
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
        {ads.map((_, index) => (
          <button
            key={index}
            onClick={() => handleDotClick(index)}
            className={`
              w-2 h-2 rounded-full transition-all duration-300
              ${index === currentAdIndex 
                ? 'bg-purple-600 scale-110' 
                : 'bg-white/50 hover:bg-white/75'}
            `}
          />
        ))}
      </div>
    </div>
  );
};

export default AdvertisementCarousel;
