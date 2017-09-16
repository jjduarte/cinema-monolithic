'use strict'
const { createContainer, asValue } = require('awilix')
const {dbSettings, serverSettings, stripeSettings, smtpSettings} = require('../config/config')
const stripe = require('stripe')
const nodemailer = require('nodemailer')
const smtpTransport = require('nodemailer-smtp-transport')

const repository = (container) => {
  const {database: db} = container.cradle
  const moviesCollection = db.collection('movies')
  const disconnect = () => {
    db.close()
  }

  const makeBooking = (user, booking) => {
    return new Promise((resolve, reject) => {
      const payload = {
        city: booking.city,
        userType: (user.membership) ? 'loyal' : 'normal',
        totalAmount: booking.totalAmount,
        cinema: {
          name: booking.cinema,
          room: booking.cinemaRoom,
          seats: booking.seats.toString()
        },
        movie: {
          title: booking.movie.title,
          format: booking.movie.format,
          schedule: booking.schedule
        }
      }

      db.collection('booking').insertOne(payload, (err, booked) => {
        if (err) {
          reject(new Error('An error occuered registring a user booking, err:' + err))
        }
        resolve(payload)
      })
    })
  }

  const generateTicket = (paid, booking) => {
    return new Promise((resolve, reject) => {
      const payload = Object.assign({}, booking, {orderId: paid.charge.id, description: paid.description})
      db.collection('tickets').insertOne(payload, (err, ticket) => {
        if (err) {
          reject(new Error('an error occured registring a ticket, err:' + err))
        }
        resolve(payload)
      })
    })
  }

  const getOrderById = (orderId) => {
    return new Promise((resolve, reject) => {
      const ObjectID = container.resolve('ObjectID')
      const query = {_id: new ObjectID(orderId)}
      const response = (err, order) => {
        if (err) {
          reject(new Error('An error occuered retrieving a order, err: ' + err))
        }
        resolve(order)
      }
      db.collection('booking').findOne(query, {}, response)
    })
  }

  //MOVIES
  const getAllMovies = () => {
    return new Promise((resolve, reject) => {
      const movies = []
      const cursor = moviesCollection.find({}, {title: 1, id: 1})
      const addMovie = (movie) => {
        movies.push(movie)
      }
      const sendMovies = (err) => {
        if (err) {
          reject(new Error('An error occured fetching all movies, err:' + err))
        }
        resolve(movies.slice())
      }
      cursor.forEach(addMovie, sendMovies)
    })
  }

  const getMoviePremiers = () => {
    return new Promise((resolve, reject) => {
      const movies = []
      const currentDay = new Date()
      const query = {
        releaseYear: {
          $gt: currentDay.getFullYear() - 1,
          $lte: currentDay.getFullYear()
        },
        releaseMonth: {
          $gte: currentDay.getMonth() + 1,
          $lte: currentDay.getMonth() + 2
        },
        releaseDay: {
          $lte: currentDay.getDate()
        }
      }
      const cursor = moviesCollection.find(query)
      const addMovie = (movie) => {
        movies.push(movie)
      }
      const sendMovies = (err) => {
        if (err) {
          reject(new Error('An error occured fetching all movies, err:' + err))
        }
        resolve(movies)
      }
      cursor.forEach(addMovie, sendMovies)
    })
  }

  const getMovieById = (id) => {
    return new Promise((resolve, reject) => {
      const projection = { _id: 0, id: 1, title: 1, format: 1 }
      const sendMovie = (err, movie) => {
        if (err) {
          reject(new Error(`An error occured fetching a movie with id: ${id}, err: ${err}`))
        }
        resolve(movie)
      }
      moviesCollection.findOne({id: id}, projection, sendMovie)
    })
  }

  //CINEMA-CATALOG

  const getCinemasByCity = (cityId) => {
    return new Promise((resolve, reject) => {
      const cinemas = []
      const query = {city_id: cityId}
      const projection = {_id: 1, name: 1}
      const cursor = db.collection('cinemas').find(query, projection)
      const addCinema = (cinema) => {
        cinemas.push(cinema)
      }
      const sendCinemas = (err) => {
        if (err) {
          reject(new Error('An error occured fetching cinemas, err: ' + err))
        }
        resolve(cinemas)
      }
      cursor.forEach(addCinema, sendCinemas)
    })
  }

  const getCinemaById = (cinemaId) => {
    return new Promise((resolve, reject) => {
      const ObjectID = container.resolve('ObjectID')
      const query = {_id: new ObjectID(cinemaId)}
      const projection = {_id: 1, name: 1, cinemaPremieres: 1}
      const response = (err, cinema) => {
        if (err) {
          reject(new Error('An error occuered retrieving a cinema, err: ' + err))
        }
        resolve(cinema)
      }
      db.collection('cinemas').findOne(query, projection, response)
    })
  }

  const getCinemaScheduleByMovie = (options) => {
    return new Promise((resolve, reject) => {
      const match = { $match: {
        'city_id': options.cityId,
        'cinemaRooms.schedules.movie_id': options.movieId
      }}
      const project = { $project: {
        'name': 1,
        'cinemaRooms.schedules.time': 1,
        'cinemaRooms.name': 1,
        'cinemaRooms.format': 1
      }}
      const unwind = [{ $unwind: '$cinemaRooms' }, { $unwind: '$cinemaRooms.schedules' }]
      const group = [{ $group: {
        _id: {
          name: '$name',
          room: '$cinemaRooms.name'
        },
        schedules: { $addToSet: '$cinemaRooms.schedules.time' }
      }}, { $group: {
        _id: '$_id.name',
        schedules: {
          $addToSet: {
            room: '$_id.room',
            schedules: '$schedules'
          }
        }
      }}]
      const sendSchedules = (err, result) => {
        if (err) {
          reject('An error has occured fetching schedules by movie, err: ' + err)
        }
        resolve(result)
      }
      db.collection('cinemas').aggregate([match, project, ...unwind, ...group], sendSchedules)
    })
  }

  //NOTIFICATION SERVICE
  const sendEmail = (payload) => {
    return new Promise((resolve, reject) => {

      const container = createContainer()

      container.register({
        serverSettings: asValue(serverSettings),
        smtpSettings: asValue(smtpSettings),
        nodemailer: asValue(nodemailer),
        smtpTransport: asValue(smtpTransport)
      })

      const transporter = nodemailer.createTransport(
        smtpTransport({
          service: smtpSettings.service,
          auth: {
            user: smtpSettings.user,
            pass: smtpSettings.pass
          }
        }))

      const mailOptions = {
        from: '"Do Not Reply, Cinemas Company 👥" <no-replay@cinemas.com>',
        to: `${payload.user.email}`,
        subject: `Tickects for movie ${payload.movie.title}`,
        html: `
            <h1>Tickest for ${payload.movie.title}</h1>

            <p>Cinem: ${payload.cinema.name}</p>
            <p>Room: ${payload.cinema.room}</p>
            <p>Seats: ${payload.cinema.seats}</p>

            <p>description: ${payload.description}</p>

            <p>Total: ${payload.totalAmount}</p>
            <p>Total: ${payload.orderId}</p>

            <h3>Cinemas Microserivce 2017, Enjoy your movie !</h3>
          `
      }

      transporter.sendMail(mailOptions, (err, info) => {
        if (err) {
          reject(new Error('An error occured sending an email, err:' + err))
        }
        transporter.close()
        resolve(info)
      })
    })
  }

  const sendSMS = (payload) => {
    // TODO: code for some sms service
  }

  //PAYMENT SERVICE
  const makePurchase = (payment) => {
    return new Promise((resolve, reject) => {
      // const {stripe} = container.cradle
      const container = createContainer()
      container.register({
        stripe: asValue(stripe(stripeSettings.secret))
      })

      container.cradle.stripe.charges.create({
        amount: Math.ceil(payment.amount * 100),
        currency: payment.currency,
        source: {
          number: payment.number,
          cvc: payment.cvc,
          exp_month: payment.exp_month,
          exp_year: payment.exp_year
        },
        description: payment.description
      }, (err, charge) => {
        if (err && err.type === 'StripeCardError') {
          reject(new Error('An error occuered procesing payment with stripe, err: ' + err))
        } else {
          const paid = Object.assign({}, {user: payment.userName, amount: payment.amount, charge})
          resolve(paid)
        }
      })
    })
  }

  const registerPurchase = (payment) => {
    return new Promise((resolve, reject) => {
      makePurchase(payment)
        .then(paid => {
          db.collection('payments').insertOne(paid, (err, result) => {
            if (err) {
              reject(new Error('an error occuered registring payment at db, err:' + err))
            }
            resolve(paid)
          })
        })
        .catch(err => reject(err))
    })
  }

  const getPurchaseById = (paymentId) => {
    return new Promise((resolve, reject) => {
      const response = (err, payment) => {
        if (err) {
          reject(new Error('An error occuered retrieving a order, err: ' + err))
        }
        resolve(payment)
      }
      db.collection('payments').findOne({'charge.id': paymentId}, {}, response)
    })
  }

  return Object.create({
    makeBooking,
    getOrderById,
    generateTicket,
    getAllMovies,
    getMoviePremiers,
    getMovieById,
    getCinemasByCity,
    getCinemaById,
    getCinemaScheduleByMovie,
    sendSMS,
    sendEmail,
    registerPurchase,
    getPurchaseById,
    disconnect
  })


}

const connect = (container) => {
  return new Promise((resolve, reject) => {
    if (!container.resolve('database')) {
      console.log("connection db not supplied");
      reject(new Error('connection db not supplied!'))
    }
    console.log("connection db supplied");
    resolve(repository(container))
  })
}

module.exports = Object.assign({}, {connect})
