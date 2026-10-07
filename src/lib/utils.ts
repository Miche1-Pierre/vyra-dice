import { createCn } from "cn/config"

/**
 * Class merger that knows the product type scale (`@utility text-*` in globals.css).
 * Without it `text-ui` reads as a text colour and `text-label-2` would silently drop it.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["micro", "caption", "footnote", "ui", "callout", "headline", "title", "display"] },
      ],
    },
  },
})
