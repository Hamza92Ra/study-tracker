import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      credentialVersion: number
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
  interface User {
    credentialVersion: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    ownerId?: string
    credentialVersion?: number
  }
}
