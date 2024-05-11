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
   * Throws BadRequestError if duplicate.
   *
   * */

  static async create({ title, salary, equity, company_handle }) {
    // Check for duplicates
    const dupCheck = await db.query(
      `SELECT * FROM jobs WHERE title = $1 AND salary=$2 AND equity=$3 AND company_handle = $4`,
      [title, salary, equity, company_handle]
    );
    if (dupCheck.rows.length > 0) {
      throw new BadRequestError("Duplicate job posting for this company.");
    }

    // create new job
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
   *
   * */

  static async findAll({ queryParams }) {
    // Start building the query string
    let query = `SELECT id, title, salary, equity, company_handle FROM jobs`;

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
    // Check if a equity filter is provided
    if (queryParams.equity && queryParams.equity === "true") {
      // Only include entries with positive equity (non-zero amount of equity)
      conditions.push(`equity > 0`);
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
   * Returns { id, title, salary, equity, companies }
   *   where companies is [{ handle, name, description, numEmployees, logoUrl }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(idData) {
    const jobRes = await db.query(
      `SELECT j.id, j.title, j.salary, j.equity, c.handle, c.name, c.description, c.num_employees, c.logo_url
           FROM jobs as j
           LEFT JOIN companies as c
           ON j.company_handle = c.handle
           WHERE id = $1`,
      [idData]
    );

    if (jobRes.rows.length === 0)
      throw new NotFoundError(`No job found: ${idData}`);

    const { id, title, salary, equity } = jobRes.rows[0];
    const job = {
      id: id,
      title: title,
      salary: salary,
      equity: equity,
      companies: [],
    };

    jobRes.rows.forEach((row) => {
      if (row.handle) {
        job.companies.push({
          handle: row.handle,
          name: row.name,
          description: row.description,
          numEmployees: row.num_employees,
          logoUrl: row.logo_url,
        });
      }
    });

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
