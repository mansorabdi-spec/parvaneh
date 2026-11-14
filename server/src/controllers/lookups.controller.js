import Joi from 'joi';
import { getPool, sql } from '../lib/db.js';

// Schemas
const categorySchema = Joi.object({
  key: Joi.string().min(2).max(100).required(),
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('', null),
  sortOrder: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true)
});

const categoryUpdateSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  description: Joi.string().allow('', null),
  sortOrder: Joi.number().integer().min(0),
  isActive: Joi.boolean()
}).min(1);

const valueSchema = Joi.object({
  categoryKey: Joi.string().min(2).max(100).required(),
  code: Joi.string().max(100).allow(null, ''),
  name: Joi.string().min(1).max(200).required(),
  nameEn: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  parentId: Joi.number().integer().allow(null),
  sortOrder: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  isRequired: Joi.boolean().default(false),
  extraJson: Joi.any(),
  discountPercentage: Joi.number().min(0).max(100).allow(null)
});

const valueUpdateSchema = Joi.object({
  code: Joi.string().max(100).allow(null, ''),
  name: Joi.string().min(1).max(200),
  nameEn: Joi.string().allow('', null),
  description: Joi.string().allow('', null),
  parentId: Joi.number().integer().allow(null),
  sortOrder: Joi.number().integer().min(0),
  isActive: Joi.boolean(),
  isRequired: Joi.boolean(),
  extraJson: Joi.any(),
  discountPercentage: Joi.number().min(0).max(100).allow(null)
}).min(1);

// Categories
export async function listCategories(req, res, next) {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query(`SELECT Id, [Key], [Name], [Description], IsActive, SortOrder FROM LookupCategory ORDER BY SortOrder, Name`);
    res.json(recordset);
  } catch (e) { next(e); }
}

export async function createCategory(req, res, next) {
  try {
    const { error, value } = categorySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    // normalize
    const key = String(value.key).trim();
    const name = String(value.name).trim();
    if (!key || !name) return res.status(400).json({ message: 'Both key and name are required' });
    // enforce key format: start with a letter, letters/digits/underscore only
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      return res.status(400).json({ message: 'Invalid key. Use English letters/numbers/underscore, starting with a letter (e.g., LicenseType, FuelType)' });
    }

    const pool = await getPool();
    // prevent duplicate key
    const exists = await pool.request().input('Key', sql.NVarChar(100), key).query('SELECT Id FROM LookupCategory WHERE [Key]=@Key');
    if (exists.recordset[0]) return res.status(409).json({ message: 'کلید تکراری است' });

    const r = await pool.request()
      .input('Key', sql.NVarChar(100), key)
      .input('Name', sql.NVarChar(200), name)
      .input('Description', sql.NVarChar(500), value.description ?? null)
      .input('IsActive', sql.Bit, value.isActive ? 1 : 0)
      .input('SortOrder', sql.Int, value.sortOrder ?? 0)
      .query('INSERT INTO LookupCategory([Key],[Name],[Description],IsActive,SortOrder) OUTPUT INSERTED.* VALUES(@Key,@Name,@Description,@IsActive,@SortOrder)');
    res.status(201).json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function updateCategory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { error, value } = categoryUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });
    const pool = await getPool();

    const existing = await pool.request().input('Id', sql.Int, id).query('SELECT * FROM LookupCategory WHERE Id=@Id');
    if (!existing.recordset[0]) return res.status(404).json({ message: 'دسته یافت نشد' });

    const nextName = (value.name !== undefined ? String(value.name).trim() : existing.recordset[0].Name);
    if (nextName.length === 0) return res.status(400).json({ message: 'نام معتبر نیست' });

    const r = await pool.request()
      .input('Id', sql.Int, id)
      .input('Name', sql.NVarChar(200), nextName)
      .input('Description', sql.NVarChar(500), value.description ?? existing.recordset[0].Description)
      .input('IsActive', sql.Bit, value.isActive == null ? existing.recordset[0].IsActive : (value.isActive ? 1 : 0))
      .input('SortOrder', sql.Int, value.sortOrder ?? existing.recordset[0].SortOrder)
      .query('UPDATE LookupCategory SET [Name]=@Name, [Description]=@Description, IsActive=@IsActive, SortOrder=@SortOrder OUTPUT INSERTED.* WHERE Id=@Id');
    res.json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function deleteCategory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    await pool.request().input('Id', sql.Int, id).query('DELETE FROM LookupCategory WHERE Id=@Id');
    res.json({ success: true });
  } catch (e) { next(e); }
}

// Values
export async function listValues(req, res, next) {
  try {
    const { categoryKey, search, active } = req.query;
    if (!categoryKey) return res.status(400).json({ message: 'categoryKey اجباری است' });

    const pool = await getPool();
    const cat = await pool.request().input('Key', sql.NVarChar(100), categoryKey).query('SELECT Id FROM LookupCategory WHERE [Key]=@Key');
    const category = cat.recordset[0];
    if (!category) return res.status(404).json({ message: 'دسته مورد نظر یافت نشد' });

    let query = `SELECT v.Id, v.CategoryId, v.Code, v.Name, v.NameEn, v.Description, v.ParentId, v.IsActive, v.IsRequired, v.SortOrder, v.ExtraJson, v.DiscountPercentage
                 FROM LookupValue v WHERE v.CategoryId=@CategoryId`;
    const reqq = pool.request().input('CategoryId', sql.Int, category.Id);

    if (active !== undefined) {
      const activeBit = (active === 'true' || active === true) ? 1 : 0;
      query += ' AND v.IsActive=@IsActive';
      reqq.input('IsActive', sql.Bit, activeBit);
    }
    if (search) {
      query += ' AND (v.Name LIKE @Q OR v.Code LIKE @Q)';
      reqq.input('Q', sql.NVarChar(200), `%${search}%`);
    }
    query += ' ORDER BY v.SortOrder, v.Name';

    const { recordset } = await reqq.query(query);
    res.json(recordset);
  } catch (e) { next(e); }
}

export async function getValue(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    const { recordset } = await pool.request().input('Id', sql.Int, id).query('SELECT * FROM LookupValue WHERE Id=@Id');
    const row = recordset[0];
    if (!row) return res.status(404).json({ message: 'رکورد یافت نشد' });
    res.json(row);
  } catch (e) { next(e); }
}

export async function createValue(req, res, next) {
  try {
    const { error, value } = valueSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const categoryKey = String(value.categoryKey).trim();
    const cat = await pool.request().input('Key', sql.NVarChar(100), categoryKey).query('SELECT Id FROM LookupCategory WHERE [Key]=@Key');
    const category = cat.recordset[0];
    if (!category) return res.status(404).json({ message: 'دسته مورد نظر یافت نشد' });

    const r = await pool.request()
      .input('CategoryId', sql.Int, category.Id)
      .input('Code', sql.NVarChar(100), value.code || null)
      .input('Name', sql.NVarChar(200), String(value.name).trim())
      .input('NameEn', sql.NVarChar(200), value.nameEn || null)
      .input('Description', sql.NVarChar(500), value.description || null)
      .input('ParentId', sql.Int, value.parentId || null)
      .input('IsActive', sql.Bit, value.isActive ? 1 : 0)
      .input('IsRequired', sql.Bit, value.isRequired ? 1 : 0)
      .input('SortOrder', sql.Int, value.sortOrder ?? 0)
      .input('ExtraJson', sql.NVarChar(sql.MAX), value.extraJson ? JSON.stringify(value.extraJson) : null)
      .input('DiscountPercentage', sql.Decimal(5, 2), value.discountPercentage ?? null)
      .query(`INSERT INTO LookupValue(CategoryId, Code, Name, NameEn, Description, ParentId, IsActive, IsRequired, SortOrder, ExtraJson, DiscountPercentage)
              OUTPUT INSERTED.*
              VALUES (@CategoryId, @Code, @Name, @NameEn, @Description, @ParentId, @IsActive, @IsRequired, @SortOrder, @ExtraJson, @DiscountPercentage)`);
    res.status(201).json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function updateValue(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { error, value } = valueUpdateSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const pool = await getPool();
    const existing = await pool.request().input('Id', sql.Int, id).query('SELECT * FROM LookupValue WHERE Id=@Id');
    const cur = existing.recordset[0];
    if (!cur) return res.status(404).json({ message: 'رکورد یافت نشد' });

    const r = await pool.request()
      .input('Id', sql.Int, id)
      .input('Code', sql.NVarChar(100), value.code ?? cur.Code)
      .input('Name', sql.NVarChar(200), value.name ?? cur.Name)
      .input('NameEn', sql.NVarChar(200), value.nameEn ?? cur.NameEn)
      .input('Description', sql.NVarChar(500), value.description ?? cur.Description)
      .input('ParentId', sql.Int, value.parentId === undefined ? cur.ParentId : (value.parentId || null))
      .input('IsActive', sql.Bit, value.isActive == null ? cur.IsActive : (value.isActive ? 1 : 0))
      .input('IsRequired', sql.Bit, value.isRequired == null ? cur.IsRequired : (value.isRequired ? 1 : 0))
      .input('SortOrder', sql.Int, value.sortOrder ?? cur.SortOrder)
      .input('ExtraJson', sql.NVarChar(sql.MAX), value.extraJson === undefined ? cur.ExtraJson : (value.extraJson ? JSON.stringify(value.extraJson) : null))
      .input('DiscountPercentage', sql.Decimal(5, 2), value.discountPercentage === undefined ? cur.DiscountPercentage : value.discountPercentage)
      .query(`UPDATE LookupValue
              SET Code=@Code, Name=@Name, NameEn=@NameEn, Description=@Description, ParentId=@ParentId,
                  IsActive=@IsActive, IsRequired=@IsRequired, SortOrder=@SortOrder, ExtraJson=@ExtraJson, DiscountPercentage=@DiscountPercentage
              OUTPUT INSERTED.* WHERE Id=@Id`);
    res.json(r.recordset[0]);
  } catch (e) { next(e); }
}

export async function deleteValue(req, res, next) {
  try {
    const id = Number(req.params.id);
    const pool = await getPool();
    await pool.request().input('Id', sql.Int, id).query('DELETE FROM LookupValue WHERE Id=@Id');
    res.json({ success: true });
  } catch (e) { next(e); }
}

export const RENEWAL_WINDOW_CATEGORY_KEY = 'RenewalWindowDays';
export const DEFAULT_RENEWAL_WINDOW_DAYS = 10;

export async function ensureRenewalWindowLookup() {
  const pool = await getPool();
  const existing = await pool.request()
    .input('Key', sql.NVarChar(100), RENEWAL_WINDOW_CATEGORY_KEY)
    .query('SELECT Id FROM LookupCategory WHERE [Key]=@Key');

  let categoryId = existing.recordset[0]?.Id;
  if (!categoryId) {
    const inserted = await pool.request()
      .input('Key', sql.NVarChar(100), RENEWAL_WINDOW_CATEGORY_KEY)
      .input('Name', sql.NVarChar(200), 'مهلت تمدید پروانه')
      .input('Description', sql.NVarChar(500), 'تعداد روز مانده تا انقضای پروانه که دکمه تمدید فعال می‌شود')
      .input('SortOrder', sql.Int, 200)
      .query(`INSERT INTO LookupCategory([Key],[Name],[Description],IsActive,SortOrder)
              OUTPUT INSERTED.Id
              VALUES(@Key,@Name,@Description,1,@SortOrder)`);
    categoryId = inserted.recordset[0].Id;
  }

  const values = await pool.request()
    .input('CategoryId', sql.Int, categoryId)
    .query('SELECT TOP 1 Id FROM LookupValue WHERE CategoryId=@CategoryId');
  if (!values.recordset[0]) {
    await pool.request()
      .input('CategoryId', sql.Int, categoryId)
      .input('Code', sql.NVarChar(100), String(DEFAULT_RENEWAL_WINDOW_DAYS))
      .input('Name', sql.NVarChar(200), 'تعداد روز')
      .input('NameEn', sql.NVarChar(200), 'Renewal window days')
      .input('Description', sql.NVarChar(500), 'مقدار پیش‌فرض ۱۰ روز')
      .query(`INSERT INTO LookupValue(CategoryId, Code, Name, NameEn, Description, IsActive, IsRequired, SortOrder)
              VALUES (@CategoryId, @Code, @Name, @NameEn, @Description, 1, 0, 1)`);
  }
}
