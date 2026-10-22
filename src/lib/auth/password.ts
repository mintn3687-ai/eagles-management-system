import bcrypt from 'bcryptjs'
export const hashPassword = (password: string) => bcrypt.hash(password, 12)
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash)

// A real bcrypt hash keeps unknown-account checks on the same work path.
export const DUMMY_PASSWORD_HASH = '$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW'
