import Joi from 'joi';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, sql } from '../lib/db.js';

// National code validation function
function isValidNationalCode(code) {
  if (!/^\d{10}$/.test(code)) return false;
  
  const check = +code[9];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += +code[i] * (10 - i);
  }
  sum %= 11;
  
  const checkDigit = sum < 2 ? sum : 11 - sum;
  return check === checkDigit;
}

const registerSchema = Joi.object({
  nationalCode: Joi.string()
    .length(10)
    .pattern(/^[0-9]+$/, 'numbers')
    .custom((value, helpers) => {
      if (!isValidNationalCode(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    }, 'valid national code')
    .required()
    .messages({
      'string.length': 'کد ملی باید 10 رقمی باشد',
      'string.pattern.base': 'کد ملی باید فقط شامل اعداد باشد',
      'any.invalid': 'کد ملی معتبر نمی‌باشد',
      'any.required': 'کد ملی الزامی است'
    }),
  password: Joi.string().min(6).max(100).required()
    .messages({
      'string.min': 'رمز عبور باید حداقل 6 کاراکتر باشد',
      'string.max': 'رمز عبور نباید بیشتر از 100 کاراکتر باشد',
      'any.required': 'رمز عبور الزامی است'
    }),
  firstName: Joi.string().max(100).required()
    .messages({
      'string.max': 'نام نباید بیشتر از 100 کاراکتر باشد',
      'any.required': 'نام الزامی است'
    }),
  lastName: Joi.string().max(100).required()
    .messages({
      'string.max': 'نام خانوادگی نباید بیشتر از 100 کاراکتر باشد',
      'any.required': 'نام خانوادگی الزامی است'
    }),
  mobile: Joi.string().length(11).pattern(/^09[0-9]{9}$/).allow('', null)
    .messages({
      'string.length': 'شماره موبایل باید 11 رقمی باشد',
      'string.pattern.base': 'شماره موبایل باید با 09 شروع شود'
    }),
  email: Joi.string().email().allow('', null)
    .messages({
      'string.email': 'ایمیل وارد شده معتبر نیست'
    }),
  profilePicture: Joi.string().allow('', null)
    .messages({
      'string.base': 'عکس پرسنلی باید به صورت base64 باشد'
    }),
  role: Joi.string().valid('Admin', 'Officer', 'User').default('User')
});

const loginSchema = Joi.object({
  nationalCode: Joi.string().required().messages({
    'any.required': 'کد ملی الزامی است'
  }),
  password: Joi.string().required().messages({
    'any.required': 'رمز عبور الزامی است'
  })
});

function signToken(user, roles) {
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const payload = { 
    id: user.Id, 
    nationalCode: user.NationalCode, 
    role: user.Role, 
    roles: roles || [], 
    firstName: user.FirstName,
    lastName: user.LastName
  };
  return jwt.sign(payload, secret, { expiresIn });
}

export async function register(req, res, next) {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();

    // Check duplicate national code
    const exists = await pool
      .request()
      .input('NationalCode', sql.NVarChar(10), value.nationalCode)
      .query('SELECT 1 FROM Users WHERE NationalCode=@NationalCode');
    if (exists.recordset[0]) return res.status(409).json({ message: 'کد ملی تکراری است' });

    const passwordHash = await bcrypt.hash(value.password, 10);

    // Handle profile picture from base64 if provided
    let profilePictureBuffer = null;
    if (req.body.profilePicture) {
      try {
        // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        const base64Data = req.body.profilePicture.replace(/^data:image\/\w+;base64,/, '');
        profilePictureBuffer = Buffer.from(base64Data, 'base64');
      } catch (err) {
        console.error('Error processing profile picture:', err);
      }
    }

    // Compute FullName for backward compatibility (if column still exists)
    const fullName = `${value.firstName} ${value.lastName}`;

    const result = await pool
      .request()
      .input('NationalCode', sql.NVarChar(10), value.nationalCode)
      .input('PasswordHash', sql.NVarChar(255), passwordHash)
      .input('FirstName', sql.NVarChar(100), value.firstName)
      .input('LastName', sql.NVarChar(100), value.lastName)
      .input('FullName', sql.NVarChar(150), fullName)
      .input('Mobile', sql.NVarChar(11), value.mobile || null)
      .input('ProfilePicture', sql.VarBinary(sql.MAX), profilePictureBuffer)
      .input('Email', sql.NVarChar(255), value.email || null)
      // enforce default role 'کاربر مستقل' (Independent) on registration
      .input('Role', sql.NVarChar(20), 'کاربر مستقل')
      .query(`
        INSERT INTO Users (NationalCode, PasswordHash, FirstName, LastName, FullName, Mobile, ProfilePicture, Email, Role, IsActive)
        OUTPUT INSERTED.Id, INSERTED.NationalCode, INSERTED.FirstName, INSERTED.LastName, INSERTED.Mobile, INSERTED.Email, INSERTED.Role, INSERTED.CreatedAt
        VALUES (@NationalCode, @PasswordHash, @FirstName, @LastName, @FullName, @Mobile, @ProfilePicture, @Email, @Role, 1)
      `);

    const user = result.recordset[0];
    // compute roles array (include primary Role)
    const rolesQuery = await pool.request().input('UserId', sql.Int, user.Id).query(`
      SELECT DISTINCT r.Name AS RoleName
      FROM (
        SELECT @UserId AS UserId, (SELECT Role FROM Users WHERE Id=@UserId) AS RoleName
        UNION ALL
        SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @UserId
      ) x
      JOIN Roles r ON r.Name = x.RoleName
    `);
    const roles = rolesQuery.recordset.map(r => r.RoleName);
    const token = signToken(user, roles);
    res.status(201).json({ user: { ...user, Roles: roles }, token });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const result = await pool
      .request()
      .input('NationalCode', sql.NVarChar(10), value.nationalCode)
      .query('SELECT TOP 1 * FROM Users WHERE NationalCode=@NationalCode');

    const user = result.recordset[0];
    if (!user) return res.status(401).json({ message: 'کد ملی یا رمز عبور نادرست است' });
    if (!user.IsActive) return res.status(403).json({ message: 'حساب کاربری شما غیرفعال است' });

    const ok = await bcrypt.compare(value.password, user.PasswordHash);
    if (!ok) return res.status(401).json({ message: 'کد ملی یا رمز عبور نادرست است' });

    // Compute roles
    const rolesQuery = await pool.request().input('UserId', sql.Int, user.Id).query(`
      SELECT DISTINCT r.Name AS RoleName
      FROM (
        SELECT @UserId AS UserId, (SELECT Role FROM Users WHERE Id=@UserId) AS RoleName
        UNION ALL
        SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @UserId
      ) x
      JOIN Roles r ON r.Name = x.RoleName
    `);
    const roles = rolesQuery.recordset.map(r => r.RoleName);

    const token = signToken(user, roles);
    // Do not expose password hash; include NationalCode for client convenience
    const safeUser = { 
      Id: user.Id, 
      FirstName: user.FirstName,
      LastName: user.LastName,
      Mobile: user.Mobile,
      Email: user.Email, 
      Role: user.Role, 
      Roles: roles, 
      NationalCode: user.NationalCode,
      CreatedAt: user.CreatedAt 
    };
    res.json({ user: safeUser, token });
  } catch (e) {
    next(e);
  }
}

export function me(req, res) {
  // Normalize JWT payload property names to match frontend expectations (uppercase)
  const normalizedUser = {
    Id: req.user?.id,
    NationalCode: req.user?.nationalCode,
    Role: req.user?.role,
    Roles: req.user?.roles || [],
    FirstName: req.user?.firstName,
    LastName: req.user?.lastName
  };
  res.json({ user: normalizedUser });
}

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).max(100).required()
});

export async function changePassword(req, res, next) {
  try {
    const { error, value } = changePasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const result = await pool
      .request()
      .input('Id', sql.Int, req.user.id)
      .query('SELECT TOP 1 * FROM Users WHERE Id=@Id');
    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });
    if (!user.IsActive) return res.status(403).json({ message: 'حساب کاربری شما غیرفعال است' });

    const ok = await bcrypt.compare(value.currentPassword, user.PasswordHash);
    if (!ok) return res.status(400).json({ message: 'رمز عبور فعلی نادرست است' });

    const hash = await bcrypt.hash(value.newPassword, 10);
    await pool
      .request()
      .input('Id', sql.Int, req.user.id)
      .input('PasswordHash', sql.NVarChar(255), hash)
      .query('UPDATE Users SET PasswordHash=@PasswordHash WHERE Id=@Id');

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// Switch user role (for users with multiple roles)
export async function switchRole(req, res, next) {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: 'نقش الزامی است' });

    const pool = await getPool();
    
    // Get user with their roles (including primary role from Users table)
    const result = await pool
      .request()
      .input('Id', sql.Int, req.user.id)
      .query('SELECT TOP 1 * FROM Users WHERE Id=@Id');
    
    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: 'کاربر یافت نشد' });
    if (!user.IsActive) return res.status(403).json({ message: 'حساب کاربری شما غیرفعال است' });

    // Compute all roles (primary role + additional roles from UserRoles)
    const rolesQuery = await pool.request().input('UserId', sql.Int, user.Id).query(`
      SELECT DISTINCT r.Name AS RoleName
      FROM (
        SELECT @UserId AS UserId, (SELECT Role FROM Users WHERE Id=@UserId) AS RoleName
        UNION ALL
        SELECT ur.UserId, r.Name FROM UserRoles ur JOIN Roles r ON r.Id = ur.RoleId WHERE ur.UserId = @UserId
      ) x
      JOIN Roles r ON r.Name = x.RoleName
    `);
    const userRoles = rolesQuery.recordset.map(r => r.RoleName);
    
    // Verify the requested role is one of the user's roles
    if (!userRoles.includes(role)) {
      return res.status(403).json({ message: 'شما دسترسی به این نقش را ندارید' });
    }

    // Generate new token with the selected role
    const token = jwt.sign(
      {
        id: user.Id,
        nationalCode: user.NationalCode,
        role: role, // Use the selected role
        roles: userRoles,
        firstName: user.FirstName,
        lastName: user.LastName
      },
      process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        Id: user.Id,
        NationalCode: user.NationalCode,
        FirstName: user.FirstName,
        LastName: user.LastName,
        Mobile: user.Mobile,
        Email: user.Email,
        Role: role, // Current active role
        Roles: userRoles, // All available roles
        IsActive: user.IsActive
      }
    });
  } catch (e) {
    next(e);
  }
}
