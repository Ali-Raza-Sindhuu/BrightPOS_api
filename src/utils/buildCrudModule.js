const pool = require('../config/db');
const ApiError = require('./ApiError');
const catchAsync = require('./catchAsync');
const sendResponse = require('./sendResponse');
const { getPagination, buildMeta } = require('./pagination');

/**
 * Builds a full model+service+controller+router for a simple table —
 * no cross-table transactions, just CRUD with pagination/search, an
 * optional uniqueness check, and an optional delete guard.
 *
 * config:
 *   table            - table name
 *   columns          - array of column names accepted on create/update
 *   requiredOnCreate  - subset of columns that must be present & non-empty
 *   searchColumns    - columns matched by `?search=`
 *   uniqueColumn     - optional column checked for duplicates on create/update
 *   entityName       - human name used in messages ("Company", "Department")
 *   references       - optional array of { table, column } checked before delete
 */
function buildCrudModule(config) {
  const {
    table,
    columns,
    requiredOnCreate = [],
    searchColumns = [],
    uniqueColumn = null,
    entityName = table,
    references = [],
  } = config;

  function searchWhere(search) {
    if (!search || !searchColumns.length) return { clause: '', params: [] };
    const clause = 'WHERE ' + searchColumns.map((c) => `${c} LIKE ?`).join(' OR ');
    return { clause, params: searchColumns.map(() => `%${search}%`) };
  }

  const model = {
    async findAll({ limit, offset, search }) {
      const { clause, params } = searchWhere(search);
      const [rows] = await pool.query(
        `SELECT * FROM \`${table}\` ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
      );
      return rows;
    },
    async count({ search }) {
      const { clause, params } = searchWhere(search);
      const [rows] = await pool.query(`SELECT COUNT(*) AS total FROM \`${table}\` ${clause}`, params);
      return rows[0].total;
    },
    async findById(id) {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
      return rows[0];
    },
    async findByUniqueValue(value, excludeId = null) {
      if (!uniqueColumn) return null;
      const params = [value];
      let query = `SELECT id FROM \`${table}\` WHERE \`${uniqueColumn}\` = ?`;
      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }
      const [rows] = await pool.query(query, params);
      return rows[0];
    },
    async create(data) {
      const cols = columns.filter((c) => data[c] !== undefined);
      const placeholders = cols.map(() => '?').join(', ');
      const values = cols.map((c) => data[c]);
      const [result] = await pool.query(
        `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES (${placeholders})`,
        values
      );
      return result.insertId;
    },
    async update(id, data) {
      const cols = columns.filter((c) => data[c] !== undefined);
      const setClause = cols.map((c) => `\`${c}\` = ?`).join(', ');
      const values = [...cols.map((c) => data[c]), id];
      await pool.query(`UPDATE \`${table}\` SET ${setClause} WHERE id = ?`, values);
    },
    async remove(id) {
      await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    },
    async countReferences(id) {
      if (!references.length) return 0;
      let total = 0;
      for (const ref of references) {
        const [[row]] = await pool.query(
          `SELECT COUNT(*) AS c FROM \`${ref.table}\` WHERE \`${ref.column}\` = ?`,
          [id]
        );
        total += row.c;
      }
      return total;
    },
  };

  const service = {
    async list(query) {
      const { page, limit, offset } = getPagination(query);
      const search = query.search?.trim();
      const [rows, total] = await Promise.all([
        model.findAll({ limit, offset, search }),
        model.count({ search }),
      ]);
      return { rows, meta: buildMeta({ page, limit, total }) };
    },
    async get(id) {
      const row = await model.findById(id);
      if (!row) throw new ApiError(404, `${entityName} not found`);
      return row;
    },
    async create(data) {
      for (const field of requiredOnCreate) {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          throw new ApiError(422, `${field} is required`);
        }
      }
      if (uniqueColumn && data[uniqueColumn] !== undefined && data[uniqueColumn] !== null) {
        const existing = await model.findByUniqueValue(data[uniqueColumn]);
        if (existing) throw new ApiError(409, `A ${entityName.toLowerCase()} with this ${uniqueColumn} already exists`);
      }
      const id = await model.create(data);
      return model.findById(id);
    },
    async update(id, data) {
      await service.get(id);
      if (uniqueColumn && data[uniqueColumn] !== undefined && data[uniqueColumn] !== null) {
        const existing = await model.findByUniqueValue(data[uniqueColumn], id);
        if (existing) throw new ApiError(409, `A ${entityName.toLowerCase()} with this ${uniqueColumn} already exists`);
      }
      await model.update(id, data);
      return model.findById(id);
    },
    async remove(id) {
      await service.get(id);
      const refs = await model.countReferences(id);
      if (refs > 0) {
        throw new ApiError(409, `Cannot delete: this ${entityName.toLowerCase()} is referenced by other records`);
      }
      await model.remove(id);
    },
  };

  const controller = {
    list: catchAsync(async (req, res) => {
      const { rows, meta } = await service.list(req.query);
      sendResponse(res, 200, `${entityName}s fetched successfully`, rows, meta);
    }),
    getOne: catchAsync(async (req, res) => {
      const row = await service.get(req.params.id);
      sendResponse(res, 200, `${entityName} fetched successfully`, row);
    }),
    create: catchAsync(async (req, res) => {
      const row = await service.create(req.body);
      sendResponse(res, 201, `${entityName} created successfully`, row);
    }),
    update: catchAsync(async (req, res) => {
      const row = await service.update(req.params.id, req.body);
      sendResponse(res, 200, `${entityName} updated successfully`, row);
    }),
    remove: catchAsync(async (req, res) => {
      await service.remove(req.params.id);
      sendResponse(res, 200, `${entityName} deleted successfully`, null);
    }),
  };

  function buildRouter() {
    const express = require('express');
    const router = express.Router();
    router.get('/', controller.list);
    router.get('/:id', controller.getOne);
    router.post('/', controller.create);
    router.put('/:id', controller.update);
    router.delete('/:id', controller.remove);
    return router;
  }

  return { model, service, controller, buildRouter };
}

module.exports = buildCrudModule;
