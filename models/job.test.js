"use strict";

const db = require("../db.js");
const { BadRequestError, NotFoundError } = require("../expressError.js");
const Job = require("./job.js");
const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
} = require("./_testCommon.js");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** create */

describe("create", function () {
  const newJob = {
    title: "new",
    salary: 123,
    equity: 1,
    company_handle: "c1",
  };

  test("job successfully created", async function () {
    let job = await Job.create(newJob);
    expect(job).toEqual({
      id: expect.any(Number),
      title: "new",
      salary: 123,
      equity: "1",
      company_handle: "c1",
    });
    const result = await db.query(
      `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE id = '${job.id}'`
    );
    expect(result.rows).toEqual([
      {
        id: expect.any(Number),
        title: "new",
        salary: 123,
        equity: "1",
        company_handle: "c1",
      },
    ]);
  });

  test("bad request with dupe", async function () {
    try {
      await Job.create(newJob);
      await Job.create(newJob);
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** findAll */

describe("findAll", function () {
  test("works: no filter", async function () {
    let jobs = await Job.findAll({ queryParams: {} });
    expect(jobs).toEqual([
      {
        company_handle: "c1",
        equity: "0",
        id: expect.any(Number),
        salary: 10,
        title: "j1",
      },
      {
        company_handle: "c1",
        equity: "1",
        id: expect.any(Number),
        salary: 20,
        title: "j2",
      },
      {
        company_handle: "c2",
        equity: "1",
        id: expect.any(Number),
        salary: 30,
        title: "j3",
      },
    ]);
  });
  test("works: equity = true filter", async function () {
    let jobs = await Job.findAll({ queryParams: { equity: true } });
    expect(jobs).toEqual([
      {
        company_handle: "c1",
        equity: "1",
        id: expect.any(Number),
        salary: 20,
        title: "j2",
      },
      {
        company_handle: "c2",
        equity: "1",
        id: expect.any(Number),
        salary: 30,
        title: "j3",
      },
    ]);
  });
  test("works: equity = false filter", async function () {
    let jobs = await Job.findAll({ queryParams: { equity: false } });
    expect(jobs).toEqual([
      {
        company_handle: "c1",
        equity: "0",
        id: expect.any(Number),
        salary: 10,
        title: "j1",
      },
      {
        company_handle: "c1",
        equity: "1",
        id: expect.any(Number),
        salary: 20,
        title: "j2",
      },
      {
        company_handle: "c2",
        equity: "1",
        id: expect.any(Number),
        salary: 30,
        title: "j3",
      },
    ]);
  });
  test("works: title and minSalary", async function () {
    let jobs = await Job.findAll({
      queryParams: { title: "j", minSalary: 30 },
    });
    expect(jobs).toEqual([
      {
        company_handle: "c2",
        equity: "1",
        id: expect.any(Number),
        salary: 30,
        title: "j3",
      },
    ]);
  });

  /************************************** get */

  describe("get", function () {
    test("works", async function () {
      let newjob = await Job.create({
        title: "new",
        salary: 123,
        equity: 1,
        company_handle: "c1",
      });
      let job = await Job.get(newjob.id);
      expect(job).toEqual({
        equity: "1",
        id: expect.any(Number),
        salary: 123,
        title: "new",
        companies: [
          {
            description: "Desc1",
            handle: "c1",
            logoUrl: "http://c1.img",
            name: "C1",
            numEmployees: 1,
          },
        ],
      });
    });

    test("not found if no such job", async function () {
      try {
        await Job.get(0);
        fail();
      } catch (err) {
        expect(err instanceof NotFoundError).toBeTruthy();
      }
    });
  });
});

/************************************** update */

describe("update", function () {
  const newJobdata = {
    title: "new",
    salary: 123,
    equity: 1,
    company_handle: "c1",
  };

  const updateData = {
    title: "updated title",
    salary: 123,
    equity: 1,
  };

  test("update works", async function () {
    let newjob = await Job.create(newJobdata);
    let job = await Job.update(`${newjob.id}`, updateData);

    expect(job).toEqual({
      id: expect.any(Number),
      title: "updated title",
      salary: 123,
      equity: "1",
      company_handle: "c1",
    });

    const result = await db.query(
      `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE id = ${newjob.id}`
    );
    expect(result.rows).toEqual([
      {
        id: expect.any(Number),
        title: "updated title",
        salary: 123,
        equity: "1",
        company_handle: "c1",
      },
    ]);
  });

  test("works: null fields", async function () {
    let newjob = await Job.create(newJobdata);

    const updateDataSetNulls = {
      title: "updated title",
      salary: null,
      equity: 1,
    };

    let job = await Job.update(`${newjob.id}`, updateDataSetNulls);
    expect(job).toEqual({
      id: expect.any(Number),
      title: "updated title",
      salary: null,
      equity: "1",
      company_handle: "c1",
    });

    const result = await db.query(
      `SELECT id, title, salary, equity, company_handle
           FROM jobs
           WHERE id = ${newjob.id}`
    );
    expect(result.rows).toEqual([
      {
        id: expect.any(Number),
        title: "updated title",
        salary: null,
        equity: "1",
        company_handle: "c1",
      },
    ]);
  });

  test("not found if no such job", async function () {
    try {
      await Job.update("0", updateData);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
  test("bad request with no data", async function () {
    try {
      let newjob = await Job.create(newJobdata);

      await Job.update(newjob.id, {});
      fail();
    } catch (err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});

/************************************** remove */

describe("remove", function () {
  const newJobdata = {
    title: "new",
    salary: 123,
    equity: 1,
    company_handle: "c1",
  };
  test("remove job works", async function () {
    let newjob = await Job.create(newJobdata);

    await Job.remove(newjob.id);
    const res = await db.query(`SELECT id FROM jobs WHERE id=${newjob.id}`);
    expect(res.rows.length).toEqual(0);
  });

  test("not found if no such job", async function () {
    try {
      await Job.remove(0);
      fail();
    } catch (err) {
      expect(err instanceof NotFoundError).toBeTruthy();
    }
  });
});
