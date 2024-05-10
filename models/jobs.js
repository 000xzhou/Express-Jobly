"use strict";

const db = require("../db");
const {
  BadRequestError,
  NotFoundError,
  ExpressError,
} = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for jobs. */

class Job {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, company_handle }
   *
   * Returns { id, title, salary, equity, company_handle }
   *
   * */

  static async create({ title, salary, equity, company_handle }) {
    const result = await db.query(
      `INSERT INTO jobs
           (title, salary, equity, company_handle)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, salary, equity, company_handle`,
      [title, salary, equity, company_handle]
    );
    const job = result.rows[0];

    return job;
  }

  /** Find all jobs.
   *
   * Returns [{ id, title, salary, equity, company_handle }, ...]
   * */

  static async findAll({ queryParams }) {
    // Start building the query string
    let query = `SELECT id, title, salary, equity, company_handle
           FROM jobs`;

    let conditions = [];
    const values = [];

    // Check if a title filter is provided
    if (queryParams.title) {
      values.push(`%${queryParams.title}%`);
      conditions.push(`title ILIKE $${values.length}`);
    }
    // Check if a minSalary filter is provided
    if (queryParams.minSalary) {
      values.push(queryParams.minSalary);
      conditions.push(`salary >= $${values.length}`);
    }

    // Check if a hasEquity filter is provided
    if (queryParams.hasEquity) {
      if (queryParams.hasEquity === "true") {
        // Only include entries with positive equity
        conditions.push(`equity > 0`);
      } else if (queryParams.hasEquity === "false") {
        // Only include entries where equity is exactly zero
        conditions.push(`equity = 0`);
      }
    } else {
      // If hasEquity is not provided, also show entries where equity is zero
      conditions.push(`equity = 0`);
    }

    // Append WHERE clause if there are any conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    // Append ORDER BY clause
    query += ` ORDER BY title`;

    const jobsRes = await db.query(query, values);
    return jobsRes.rows;
  }

  /** Given a job id, return data about jobs.
   *
   * Returns { id, title, salary, equity, company_handle, companies }
   *   where companies is [{ handle, name, description, numEmployees, logoUrl }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const jobRes = await db.query(
      `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE id = $1`,
      [id]
    );

    const job = jobRes.rows[0];

    if (!job) throw new NotFoundError(`No job: ${handle}`);

    return job;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {title, salary, equity}
   *
   * Returns {id, title, salary, equity, company_handle}
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(data, {
      title: "title",
      salary: "salary",
      equity: "equity",
    });
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE id = ${idVarIdx} 
                      RETURNING id, title, salary, equity, company_handle`;
    const result = await db.query(querySql, [...values, id]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${id}`);

    return company;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(id) {
    const result = await db.query(
      `DELETE
           FROM jobs
           WHERE id = $1
           RETURNING id`,
      [id]
    );
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${id}`);
  }
}

module.exports = Job;
