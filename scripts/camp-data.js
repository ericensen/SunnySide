(function () {
  const camps = [
    {
      slug: "science-stem",
      title: "Science & STEM Camp",
      shortDate: "June 17, 2026",
      image: "pictures/science-camp_cropped.jpg",
      imageAlt: "Kids exploring colorful science materials at science camp",
      colors: ["#57c7ff", "#9be7ff"],
      blurb: "Fizzing experiments, curious questions, and build-it challenges.",
      description:
        "Kids will mix, test, build, and explore through playful science stations and hands-on STEM moments designed for big smiles and bigger discoveries.",
      details: [
        "From bubbling reactions to mini engineering tasks, this camp is all about curiosity in motion.",
        "The day mixes high-energy discovery with simple problem-solving challenges so campers can create, test, tweak, and celebrate what they make."
      ],
      highlights: ["Hands-on experiments", "Mini builder challenges", "Take-home discovery pride"],
      photoCaption: "Bubble lab fun"
    },
    {
      slug: "arts-crafts",
      title: "Arts and Crafts Camp",
      shortDate: "June 24, 2026",
      image: "pictures/ArtsCrafts-Camp_cropped.jpg",
      imageAlt: "Kids working on bright arts and crafts projects",
      colors: ["#ff9ad5", "#ffd36c"],
      blurb: "Paint, glue, sparkle, snip, and bring every idea to life.",
      description:
        "This camp is a joyful mix of color, texture, imagination, and proudly carried-home creations.",
      details: [
        "Campers will move through guided projects and open-ended craft stations that let their personalities shine.",
        "Expect cheerful messes, bright colors, and artwork kids will be excited to show off at pickup."
      ],
      highlights: ["Color-packed projects", "Creative confidence", "Lots of display-worthy art"],
      photoCaption: "Paint and paste station"
    },
    {
      slug: "cooking",
      title: "Cooking Camp",
      shortDate: "July 1, 2026",
      image: "pictures/Cooking-Camp_cropped.jpg",
      imageAlt: "Kids cooking and decorating treats during cooking camp",
      colors: ["#ffb36b", "#fff08c"],
      blurb: "Mix, measure, decorate, and taste-test a delicious day.",
      description:
        "Kids will stir up kitchen confidence through simple recipes, snack-making fun, and hands-on food creativity.",
      details: [
        "The day focuses on age-friendly food prep, teamwork, and the excitement of making something yummy from start to finish.",
        "It is playful, practical, and packed with opportunities to try new flavors and kitchen skills."
      ],
      highlights: ["Kid-friendly recipes", "Snack decorating fun", "Kitchen confidence"],
      photoCaption: "Whisk and mix station"
    },
    {
      slug: "sports-movement",
      title: "Sports and Movement Camp",
      shortDate: "July 8, 2026",
      image: "pictures/Sports-Camp.webp",
      imageAlt: "Kids playing energetic games at sports and movement camp",
      colors: ["#69d78b", "#8fd3ff"],
      blurb: "Run, stretch, laugh, and move through energetic camp games.",
      description:
        "This camp keeps kids active with playful relays, movement games, teamwork activities, and confidence-building fun.",
      details: [
        "It is built around participation, encouragement, and trying lots of different ways to move rather than strict competition.",
        "Kids can expect a day that feels upbeat, social, and full of cheers."
      ],
      highlights: ["Movement games", "Friendly teamwork", "High-energy camp spirit"],
      photoCaption: "Relay game ready"
    },
    {
      slug: "water-day",
      title: "Water Day Camp",
      shortDate: "July 15, 2026",
      image: "pictures/Water-Camp_cropped.jpg",
      imageAlt: "Kids splashing and cooling off during water day camp",
      colors: ["#59d6ff", "#8ff7e2"],
      blurb: "Splash, cool down, and laugh through sunny water-play fun.",
      description:
        "Water Day Camp is made for summer grins with splash games, playful challenges, and refreshing outdoor fun.",
      details: [
        "The vibe is bright, active, and silly with camp moments that help kids burn energy and stay cool.",
        "It is a perfect mid-summer camp day for kids who love water balloons, relay races, and splashy surprises."
      ],
      highlights: ["Splash games", "Summer cooling fun", "Outdoor laughter all day"],
      photoCaption: "Splash zone action"
    },
    {
      slug: "wizarding",
      title: "Hogwarts / Wizarding Camp",
      shortDate: "July 22, 2026",
      image: "pictures/Wizards-Camp_cropped.jpg",
      imageAlt: "Kids enjoying wizard-themed camp activities",
      colors: ["#8a7cff", "#ffd86b"],
      blurb: "Potions, quests, enchanted crafts, and magical camp wonder.",
      description:
        "This wizarding day invites kids into a world of imaginative play, spellbook-style activities, and magical teamwork.",
      details: [
        "Expect potion-inspired experiments, themed challenges, and camp storytelling that feels playful and immersive.",
        "It is a whimsical mix of mystery, imagination, and just enough sparkle."
      ],
      highlights: ["Potion play", "Quest-style challenges", "Magical imagination"],
      photoCaption: "Potion table setup"
    },
    {
      slug: "carnival",
      title: "Carnival Camp",
      shortDate: "July 29, 2026",
      image: "pictures/Carnival-Camp.jpg",
      imageAlt: "Kids enjoying carnival games and colorful booths",
      colors: ["#ff7b7b", "#ffd26a"],
      blurb: "Games, prizes, colorful booths, and big end-of-summer energy.",
      description:
        "Carnival Camp wraps the season with celebration, playful stations, cheerful competition, and lots of bright camp spirit.",
      details: [
        "Kids can rotate through game-inspired activities, themed challenges, and festive moments that feel like a mini fair day.",
        "It is the kind of camp that closes summer with laughter, color, and stories to take home."
      ],
      highlights: ["Game booth fun", "Prize-worthy excitement", "Big summer-finale energy"],
      photoCaption: "Carnival game corner"
    }
  ];

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value);
  }

  function campUrl(slug) {
    return "camp.html?camp=" + encodeURIComponent(slug);
  }

  function checkoutUrl(slug) {
    return slug ? "checkout.html?camp=" + encodeURIComponent(slug) : "checkout.html";
  }

  window.SUNNYSIDE_DATA = {
    pricePerKid: 30,
    maxOpenings: 20,
    camps: camps,
    money: money,
    campUrl: campUrl,
    checkoutUrl: checkoutUrl,
    getCamp: function (slug) {
      return camps.find(function (camp) {
        return camp.slug === slug;
      });
    }
  };
})();
