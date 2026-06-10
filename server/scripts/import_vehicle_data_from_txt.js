/**
 * Import Vehicle Data from text file
 * Reads data.txt line by line and imports into VehicleType, Systemtype, and Tiptype tables
 * 
 * Usage: node import_vehicle_data_from_txt.js
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { sql, getPool } from '../src/lib/db.js'

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Path to data.txt file
const DATA_FILE = path.join(__dirname, '..', '..', 'data.txt')

// Statistics
const stats = {
  linesProcessed: 0,
  vehicleTypesInserted: 0,
  systemsInserted: 0,
  tipsInserted: 0,
  errors: 0
}

// Cache for already inserted records
const vehicleTypeCache = new Map() // name -> ID
const systemTypeCache = new Map()  // name|vehicleTypeId -> ID

/**
 * Get or create VehicleType
 */
async function getOrCreateVehicleType(pool, vehicleTypeName) {
  const trimmedName = vehicleTypeName.trim()
  
  // Check cache
  if (vehicleTypeCache.has(trimmedName)) {
    return vehicleTypeCache.get(trimmedName)
  }
  
  try {
    // Check if exists in database
    const result = await pool.request()
      .input('name', sql.NVarChar, trimmedName)
      .query('SELECT ID FROM VehicleType WHERE VehicleTypeName = @name')
    
    if (result.recordset.length > 0) {
      const id = result.recordset[0].ID
      vehicleTypeCache.set(trimmedName, id)
      return id
    }
    
    // Insert new vehicle type
    const insertResult = await pool.request()
      .input('name', sql.NVarChar, trimmedName)
      .query('INSERT INTO VehicleType (VehicleTypeName, CreatedAt) OUTPUT INSERTED.ID VALUES (@name, GETDATE())')
    
    const id = insertResult.recordset[0].ID
    vehicleTypeCache.set(trimmedName, id)
    stats.vehicleTypesInserted++
    console.log(`  ✅ Created VehicleType: ${trimmedName} (ID: ${id})`)
    
    return id
  } catch (error) {
    console.error(`  ❌ Error with VehicleType "${trimmedName}":`, error.message)
    throw error
  }
}

/**
 * Get or create Systemtype
 */
async function getOrCreateSystemType(pool, systemName, vehicleTypeId) {
  const trimmedName = systemName.trim()
  const cacheKey = `${trimmedName}|${vehicleTypeId}`
  
  // Check cache
  if (systemTypeCache.has(cacheKey)) {
    return systemTypeCache.get(cacheKey)
  }
  
  try {
    // Check if exists in database with this vehicle type
    let result = await pool.request()
      .input('name', sql.NVarChar, trimmedName)
      .input('vehicleTypeId', sql.Int, vehicleTypeId)
      .query('SELECT ID FROM Systemtype WHERE systemname = @name AND VehicleTypeID = @vehicleTypeId')
    
    if (result.recordset.length > 0) {
      const id = result.recordset[0].ID
      systemTypeCache.set(cacheKey, id)
      return id
    }
    
    // Check if system exists without vehicle type (update it)
    result = await pool.request()
      .input('name', sql.NVarChar, trimmedName)
      .query('SELECT ID FROM Systemtype WHERE systemname = @name AND VehicleTypeID IS NULL')
    
    if (result.recordset.length > 0) {
      const id = result.recordset[0].ID
      // Update with vehicle type
      await pool.request()
        .input('id', sql.Int, id)
        .input('vehicleTypeId', sql.Int, vehicleTypeId)
        .query('UPDATE Systemtype SET VehicleTypeID = @vehicleTypeId WHERE ID = @id')
      
      systemTypeCache.set(cacheKey, id)
      console.log(`  🔄 Updated Systemtype: ${trimmedName} with VehicleTypeID ${vehicleTypeId}`)
      return id
    }
    
    // Insert new system type
    const insertResult = await pool.request()
      .input('name', sql.NVarChar, trimmedName)
      .input('vehicleTypeId', sql.Int, vehicleTypeId)
      .query('INSERT INTO Systemtype (systemname, VehicleTypeID, ID_User) OUTPUT INSERTED.ID VALUES (@name, @vehicleTypeId, NULL)')
    
    const id = insertResult.recordset[0].ID
    systemTypeCache.set(cacheKey, id)
    stats.systemsInserted++
    console.log(`  ✅ Created Systemtype: ${trimmedName} (ID: ${id})`)
    
    return id
  } catch (error) {
    console.error(`  ❌ Error with Systemtype "${trimmedName}":`, error.message)
    throw error
  }
}

/**
 * Create Tiptype if not exists
 */
async function createTipType(pool, tipName, systemTypeId) {
  const trimmedName = tipName.trim()
  
  try {
    // Check if exists
    const result = await pool.request()
      .input('name', sql.NVarChar, trimmedName)
      .input('systemId', sql.Int, systemTypeId)
      .query('SELECT ID FROM Tiptype WHERE tipname = @name AND SystemtypeID = @systemId')
    
    if (result.recordset.length > 0) {
      return result.recordset[0].ID
    }
    
    // Insert new tip type
    const insertResult = await pool.request()
      .input('name', sql.NVarChar, trimmedName)
      .input('systemId', sql.Int, systemTypeId)
      .query('INSERT INTO Tiptype (tipname, SystemtypeID, ID_User) OUTPUT INSERTED.ID VALUES (@name, @systemId, NULL)')
    
    const id = insertResult.recordset[0].ID
    stats.tipsInserted++
    console.log(`  ✅ Created Tiptype: ${trimmedName} (ID: ${id})`)
    
    return id
  } catch (error) {
    console.error(`  ❌ Error with Tiptype "${trimmedName}":`, error.message)
    throw error
  }
}

/**
 * Process a single line of data
 */
async function processLine(pool, line, lineNumber) {
  // Skip empty lines
  if (!line.trim()) {
    return
  }
  
  // Split by tab (Excel copy-paste typically uses tabs)
  let parts = line.split('\t')
  
  // If no tabs, try comma
  if (parts.length < 3) {
    parts = line.split(',')
  }
  
  // If still not enough parts, try spaces
  if (parts.length < 3) {
    parts = line.split(/\s{2,}/) // Split by 2 or more spaces
  }
  
  if (parts.length < 3) {
    console.log(`⚠️  Line ${lineNumber}: Not enough columns (expected 3, got ${parts.length})`)
    console.log(`   Content: ${line.substring(0, 100)}...`)
    stats.errors++
    return
  }
  
  const vehicleTypeName = parts[0].trim()
  const systemName = parts[1].trim()
  const tipName = parts[2].trim()
  
  // Skip header row
  if (vehicleTypeName === 'نوع' || vehicleTypeName === 'نوع وسیله' || lineNumber === 1) {
    console.log(`⏭️  Line ${lineNumber}: Skipped header row`)
    return
  }
  
  // Skip if any field is empty
  if (!vehicleTypeName || !systemName || !tipName) {
    console.log(`⚠️  Line ${lineNumber}: Empty fields detected`)
    stats.errors++
    return
  }
  
  try {
    // Step 1: Get or create VehicleType
    const vehicleTypeId = await getOrCreateVehicleType(pool, vehicleTypeName)
    
    // Step 2: Get or create Systemtype
    const systemTypeId = await getOrCreateSystemType(pool, systemName, vehicleTypeId)
    
    // Step 3: Create Tiptype
    await createTipType(pool, tipName, systemTypeId)
    
    stats.linesProcessed++
    
    if (stats.linesProcessed % 50 === 0) {
      console.log(`\n📊 Progress: ${stats.linesProcessed} lines processed...`)
    }
  } catch (error) {
    console.error(`❌ Line ${lineNumber} failed:`, error.message)
    stats.errors++
  }
}

/**
 * Main import function
 */
async function importData() {
  console.log('🚀 Starting vehicle data import from text file...')
  console.log(`📂 Reading from: ${DATA_FILE}`)
  console.log('')
  
  // Check if file exists
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ Error: File not found: ${DATA_FILE}`)
    console.log('Please create data.txt in the project root directory')
    process.exit(1)
  }
  
  let pool
  
  try {
    // Connect to database
    console.log('🔌 Connecting to database...')
    pool = await getPool()
    console.log('✅ Connected to database')
    console.log('')
    
    // Read file content
    const fileContent = fs.readFileSync(DATA_FILE, 'utf-8')
    const lines = fileContent.split('\n')
    
    console.log(`📄 Found ${lines.length} lines in file`)
    console.log('⚙️  Processing data...')
    console.log('')
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      await processLine(pool, lines[i], i + 1)
    }
    
    // Print summary
    console.log('')
    console.log('═══════════════════════════════════════')
    console.log('📊 IMPORT SUMMARY')
    console.log('═══════════════════════════════════════')
    console.log(`✅ Lines Processed: ${stats.linesProcessed}`)
    console.log(`✅ Vehicle Types Created: ${stats.vehicleTypesInserted}`)
    console.log(`✅ Systems Created: ${stats.systemsInserted}`)
    console.log(`✅ Tips Created: ${stats.tipsInserted}`)
    console.log(`❌ Errors: ${stats.errors}`)
    console.log('═══════════════════════════════════════')
    console.log('')
    
    // Show final counts in database
    const vtCount = await pool.request().query('SELECT COUNT(*) as count FROM VehicleType')
    const stCount = await pool.request().query('SELECT COUNT(*) as count FROM Systemtype')
    const ttCount = await pool.request().query('SELECT COUNT(*) as count FROM Tiptype')
    
    console.log('📊 FINAL DATABASE COUNTS')
    console.log('═══════════════════════════════════════')
    console.log(`VehicleType: ${vtCount.recordset[0].count} records`)
    console.log(`Systemtype: ${stCount.recordset[0].count} records`)
    console.log(`Tiptype: ${ttCount.recordset[0].count} records`)
    console.log('═══════════════════════════════════════')
    console.log('')
    console.log('✅ Import completed successfully!')
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  } finally {
    if (pool) {
      await pool.close()
    }
  }
}

// Run import
importData().catch(console.error)
