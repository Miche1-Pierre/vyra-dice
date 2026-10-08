import { defineClub } from "@/lib/clubs/club"

import ambiance from "./ambiance.json"
import content from "./content.json"
import layout from "./layout.json"
import assets from "./public/lightmaps.json"

/** Naho Club, La Garde: prospecting demo, see README.md. */
export default defineClub({ content, layout, ambiance, assets })
