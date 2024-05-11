"use strict";

const db = require("../db");
const {
  BadRequestError,
  NotFoundError,
  ExpressError,
} = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for companies. */

class Company {
  /** Create a company (from data), update db, return new company data.
   *
   * data should be { handle, name, description, numEmployees, logoUrl }
   *
   * Returns { handle, name, description, numEmployees, logoUrl }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create({ handle, name, description, numEmployees, logoUrl }) {
    const duplicateCheck = await db.query(
      `SELECT handle
           FROM companies
           WHERE handle = $1`,
      [handle]
    );

    if (duplicateCheck.rows[0])
      throw new BadRequestError(`Duplicate company: ${handle}`);

    const result = await db.query(
      `INSERT INTO companies
           (handle, name, description, num_employees, logo_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING handle, name, description, num_employees AS "numEmployees", logo_url AS "logoUrl"`,
      [handle, name, description, numEmployees, logoUrl]
    );
    const company = result.rows[0];

    return company;
  }

  /** Find all companies.
   *
   * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
   * */

  static async findAll({ queryParams }) {
    // Check if a both min and max filter is provided
    if (queryParams.minEmployees && queryParams.maxEmployees) {
      // check If the minEmployees parameter is greater than the maxEmployees parameter
      if (
        parseInt(queryParams.minEmployees) >= parseInt(queryParams.maxEmployees)
      ) {
        throw new ExpressError(
          `Min Employees can't be larger or equal to max Employees`,
          400
        );
      }
    }
    // Start building the query string
    let query = `SELECT handle,
                  name,
                  description,
                  num_employees AS "numEmployees",
                  logo_url AS "logoUrl"
           FROM companies`;

    let conditions = [];
    const values = [];

    // Check if a name filter is provided
    if (queryParams.nameLike) {
      values.push(`%${queryParams.nameLike}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }
    // Check if a minimum employee filter is provided
    if (queryParams.minEmployees) {
      values.push(queryParams.minEmployees);
      conditions.push(`num_employees >= $${values.length}`);
    }

    // Check if a maximum employee filter is provided
    if (queryParams.maxEmployees) {
      values.push(queryParams.maxEmployees);
      conditions.push(`num_employees <= $${values.length}`);
    }

    // Append WHERE clause if there are any conditions
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }
    // Append ORDER BY clause
    query += ` ORDER BY name`;

    const companiesRes = await db.query(query, values);
    return companiesRes.rows;
  }

  /** Given a company handle, return data about company.
   *
   * Returns { handle, name, description, numEmployees, logoUrl, jobs }
   *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(handleData) {
    const companyRes = await db.query(
      `SELECT c.handle,
                  c.name,
                  c.description,
                  c.num_employees,
                  c.logo_url,
                  j.id, j.title, j.salary, j.equity, j.company_handle
           FROM companies as c
           LEFT JOIN jobs as j
           ON c.handle = j.company_handle
           WHERE handle = $1`,
      [handleData]
    );

    if (companyRes.rows.length === 0)
      throw new NotFoundError(`No company: ${handleData}`);

    const { handle, name, description, num_employees, logo_url } =
      companyRes.rows[0];

    // seting up return  data
    const company = {
      handle: handle,
      name: name,
      description: description,
      numEmployees: num_employees,
      logoUrl: logo_url,
      jobs: [],
    };
    // pushing job into company.jobs array
    companyRes.rows.forEach((row) => {
      if (row.id) {
        company.jobs.push({
          id: row.id,
          title: row.title,
          salary: row.salary,
          equity: row.equity,
          companyHandle: row.company_handle,
        });
      }
    });

    return company;
  }

  /** Update company data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {name, description, numEmployees, logoUrl}
   *
   * Returns {handle, name, description, numEmployees, logoUrl}
   *
   * Throws NotFoundError if not found.
   */

  static async update(handle, data) {
    const { setCols, values } = sqlForPartialUpdate(data, {
      numEmployees: "num_employees",
      logoUrl: "logo_url",
    });
    const handleVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE companies 
                      SET ${setCols} 
                      WHERE handle = ${handleVarIdx} 
                      RETURNING handle, 
                                name, 
                                description, 
                                num_employees AS "numEmployees", 
                                logo_url AS "logoUrl"`;
    const result = await db.query(querySql, [...values, handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(handle) {
    const result = await db.query(
      `DELETE
           FROM companies
           WHERE handle = $1
           RETURNING handle`,
      [handle]
    );
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);
  }
}

module.exports = Company;
