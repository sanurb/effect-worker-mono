import { Option } from "effect";

export const seo = ({
  title,
  description,
  keywords,
  image,
}: {
  title: string;
  description?: string;
  image?: string;
  keywords?: string;
}) => {
  const tags = [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:creator", content: "@tannerlinsley" },
    { name: "twitter:site", content: "@tannerlinsley" },
    { name: "og:type", content: "website" },
    { name: "og:title", content: title },
    { name: "og:description", content: description },
    ...Option.match(Option.fromNullishOr(image), {
      onNone: (): ReadonlyArray<{ readonly name: string; readonly content: string }> => [],
      onSome: (src) => [
        { name: "twitter:image", content: src },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "og:image", content: src },
      ],
    }),
  ];

  return tags;
};
