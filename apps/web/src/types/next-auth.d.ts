import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      organizationId?: string;
      teamIds?: string[];
    };
  }

  interface User {
    id: string;
    organizationId?: string;
    teamIds?: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    organizationId?: string;
    teamIds?: string[];
  }
}

