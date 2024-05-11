"use strict";

const request = require("supertest");

const db = require("../db");
const app = require("../app");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  u1Token,
  a1TokenAdmin,
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** POST /jobs */

describe("POST /companies", function () {
  const newJob = {
    title: "new",
    salary: 123,
    equity: 1,
    company_handle: "c1",
  };
  test("Admin create job", async function () {
    const resp = await request(app)
      .post("/jobs")
      .send(newJob)
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.statusCode).toEqual(201);
    expect(resp.body).toEqual({
      job: {
        id: expect.any(Number),
        title: "new",
        salary: 123,
        equity: "1",
        company_handle: "c1",
      },
    });
  });
  test("user without admin authorization fails to create job", async function () {
    const resp = await request(app)
      .post("/jobs")
      .send(newJob)
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
  });
  test("bad request with missing data", async function () {
    const resp = await request(app)
      .post("/jobs")
      .send({
        title: "new",
        salary: 123,
      })
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.statusCode).toEqual(400);
  });
  test("bad request with invalid data", async function () {
    const resp = await request(app)
      .post("/jobs")
      .send({
        title: "new",
        salary: 123,
        equity: "1",
        company_handle: "c1",
      })
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** GET /jobs */

describe("GET /jobs", function () {
  test("ok for anon", async function () {
    const resp = await request(app).get("/jobs");
    expect(resp.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: "j1",
          salary: 123,
          equity: "1",
          company_handle: "c1",
        },
        {
          id: expect.any(Number),
          title: "j2",
          salary: 321,
          equity: "0",
          company_handle: "c1",
        },
      ],
    });
  });
  test("ok with title filter", async function () {
    const resp = await request(app).get("/jobs?title=j1");
    expect(resp.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: "j1",
          salary: 123,
          equity: "1",
          company_handle: "c1",
        },
      ],
    });
  });
  test("ok with minSalary filter", async function () {
    const resp = await request(app).get("/jobs?minSalary=300");
    expect(resp.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: "j2",
          salary: 321,
          equity: "0",
          company_handle: "c1",
        },
      ],
    });
  });
  test("ok with equity true filter", async function () {
    const resp = await request(app).get("/jobs?equity=true");
    expect(resp.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: "j1",
          salary: 123,
          equity: "1",
          company_handle: "c1",
        },
      ],
    });
  });
  test("ok with equity false filter", async function () {
    const resp = await request(app).get("/jobs?equity=false");
    expect(resp.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: "j1",
          salary: 123,
          equity: "1",
          company_handle: "c1",
        },
        {
          id: expect.any(Number),
          title: "j2",
          salary: 321,
          equity: "0",
          company_handle: "c1",
        },
      ],
    });
  });
  test("ok with all filters", async function () {
    const resp = await request(app).get(
      "/jobs?title=j1&minSalary=100&equity=true"
    );
    expect(resp.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: "j1",
          salary: 123,
          equity: "1",
          company_handle: "c1",
        },
      ],
    });
  });
  test("fails: test next() handler", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-handler works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE jobs CASCADE");
    const resp = await request(app)
      .get("/jobs")
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(500);
  });
});

/************************************** GET /jobs/:id */

describe("GET /jobs/:handle", function () {
  test("works for anon", async function () {
    // get job
    const job = await request(app).get("/jobs?title=j1");
    //   get job by id
    const resp = await request(app).get(`/jobs/${job.body.jobs[0].id}`);
    console.log(resp.body);
    expect(resp.body).toEqual({
      job: {
        id: expect.any(Number),
        title: "j1",
        salary: 123,
        equity: "1",
        companies: [
          {
            description: "Desc1",
            handle: "c1",
            logoUrl: "http://c1.img",
            name: "C1",
            numEmployees: 1,
          },
        ],
      },
    });
  });
  test("not found for no such job", async function () {
    const resp = await request(app).get(`/jobs/0`);
    expect(resp.statusCode).toEqual(404);
  });
});

/************************************** PATCH /jobs/:id */

describe("PATCH /jobs/:id", function () {
  test("works for admin", async function () {
    const job = await request(app).get("/jobs?title=j1");

    const resp = await request(app)
      .patch(`/jobs/${job.body.jobs[0].id}`)
      .send({
        title: "new job",
      })
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.body).toEqual({
      job: {
        id: expect.any(Number),
        title: "new job",
        salary: 123,
        equity: "1",
        company_handle: "c1",
      },
    });
  });
  test("unauth for users that isn't admin", async function () {
    const job = await request(app).get("/jobs?title=j1");

    const resp = await request(app)
      .patch(`/jobs/${job.body.jobs[0].id}`)
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
  });
  test("unauth for anon", async function () {
    const job = await request(app).get("/jobs?title=j1");

    const resp = await request(app)
      .patch(`/jobs/${job.body.jobs[0].id}}`)
      .send({
        title: "C1-new",
      });
    expect(resp.statusCode).toEqual(401);
  });
  test("not found on no such job", async function () {
    const resp = await request(app)
      .patch(`/jobs/0`)
      .send({
        title: "new nope",
      })
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.statusCode).toEqual(404);
  });
  test("bad request on handle change attempt", async function () {
    const job = await request(app).get("/jobs?title=j1");

    const resp = await request(app)
      .patch(`/jobs/${job.body.jobs[0].id}}`)
      .send({
        company_handle: "c1-new",
      })
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.statusCode).toEqual(400);
  });
  test("bad request on invalid data", async function () {
    const job = await request(app).get("/jobs?title=j1");

    const resp = await request(app)
      .patch(`/jobs/${job.body.jobs[0].id}}`)
      .send({
        salary: "not-a-number",
      })
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** DELETE /jobs/:id */

describe("DELETE /jobs/:handle", function () {
  test("works for admin", async function () {
    const job = await request(app).get("/jobs?title=j1");
    const resp = await request(app)
      .delete(`/jobs/${job.body.jobs[0].id}`)
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.body).toEqual({ deleted: job.body.jobs[0].id.toString() });
  });
  test("donesn't works for users", async function () {
    const job = await request(app).get("/jobs?title=j1");
    const resp = await request(app)
      .delete(`/jobs/${job.body.jobs[0].id}`)
      .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(401);
  });
  test("unauth for anon", async function () {
    const job = await request(app).get("/jobs?title=j1");
    const resp = await request(app).delete(`/jobs/${job.body.jobs[0].id}`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found for no such company", async function () {
    const resp = await request(app)
      .delete(`/jobs/0`)
      .set("authorization", `Bearer ${a1TokenAdmin}`);
    expect(resp.statusCode).toEqual(404);
  });
});
