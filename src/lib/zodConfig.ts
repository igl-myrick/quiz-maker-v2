// Stops Zod probing `new Function`, which the Content-Security-Policy blocks (change 10).
// main.tsx imports this first: imports run before main.tsx's own code, and the settings
// store already parses with Zod while it is being imported.
import { z } from 'zod'

z.config({ jitless: true })
