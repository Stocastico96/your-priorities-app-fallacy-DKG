"use strict";
var express = require("express");
var router = express.Router();
var models = require("../models/index.cjs");
var auth = require("../authorization.cjs");
var log = require("../utils/logger.cjs");
var toJson = require("../utils/to_json.cjs");
var async = require("async");
const ogs = require("open-graph-scraper");
var _ = require("lodash");
var queue = require("../services/workers/queue.cjs");
var delibAiService = require("../services/moderation/delibAiService.cjs");
const axios = require("axios");
// DKG configuration
const DKG_BASE_URL = process.env.DKG_BASE_URL || "https://dkg.svagnoni.linkeddata.es";
/**
 * Send point/contribution to Deliberation Knowledge Graph
 */
async function sendPointToDKG(point) {
    try {
        // Check if fallacy analysis exists for this point
        const fallacyLabel = await models.CommentFallacyLabel.findOne({
            where: {
                content_type: "point",
                content_id: point.id,
            },
            order: [["created_at", "DESC"]],
        });
        const fallacies = [];
        if (fallacyLabel && fallacyLabel.labels && fallacyLabel.labels.length > 0) {
            // If fallacies exist, include them
            for (let i = 0; i < fallacyLabel.labels.length; i++) {
                fallacies.push({
                    type: fallacyLabel.labels[i],
                    score: fallacyLabel.scores[i] || 0,
                    rationale: fallacyLabel.advice || "",
                });
            }
        }
        const payload = {
            contribution_id: `point-${point.id}`,
            text: point.content,
            fallacies: fallacies,
            timestamp: point.created_at || new Date().toISOString(),
            user_id: point.user_id || point.User?.id,
            user_name: point.User?.name || point.User?.email || "Anonymous",
            post_id: point.post_id,
            post_name: point.Post?.name || "Unknown Post",
            group_id: point.group_id,
            group_name: point.Group?.name || "Unknown Group",
            community_id: point.Group?.Community?.id,
            community_name: point.Group?.Community?.name || "Unknown Community",
            value: point.value, // 1=FOR/supports, -1=AGAINST/attacks, 0=NEUTRAL
            parent_point_id: point.parent_point_id, // For point-to-point responses
        };
        log.info("Sending point to DKG", { pointId: point.id, hasFallacies: fallacies.length > 0 });
        const response = await axios.post(`${DKG_BASE_URL}/api/ingest/fallacy`, payload, {
            headers: { "Content-Type": "application/json" },
            timeout: 5000,
        });
        log.info("DKG ingest success", {
            pointId: point.id,
            fallaciesAdded: response.data.fallacies_added,
            totalTriples: response.data.total_triples,
        });
        return response.data;
    }
    catch (error) {
        // Log error but don't fail the main request
        log.error("Failed to send point to DKG", {
            pointId: point.id,
            error: error.message,
            response: error.response ? error.response.data : null,
        });
        return null;
    }
}
var changePointCounter = function (pointId, column, upDown, next) {
    models.Point.findOne({
        where: { id: pointId },
    }).then(function (point) {
        if (point && upDown === 1) {
            point.increment(column).then(function () {
                next();
            });
        }
        else if (point && upDown === -1) {
            point.decrement(column).then(function () {
                next();
            });
        }
        else {
            next();
        }
    });
};
var decrementOldPointQualityCountersIfNeeded = function (oldPointQualityValue, pointId, pointQuality, next) {
    if (oldPointQualityValue) {
        if (oldPointQualityValue > 0) {
            changePointCounter(pointId, "counter_quality_up", -1, function () {
                next();
            });
        }
        else if (oldPointQualityValue < 0) {
            changePointCounter(pointId, "counter_quality_down", -1, function () {
                next();
            });
        }
        else {
            log.error("Strange state of pointQualities");
            next();
        }
    }
    else {
        next();
    }
};
var sendPointOrError = function (res, point, context, user, error, errorStatus) {
    if (error || !point) {
        if (errorStatus == 404) {
            log.warn("Point Not Found", {
                context: context,
                point: toJson(point),
                user: toJson(user),
                err: error,
                errorStatus: 404,
            });
        }
        else {
            log.error("Point Error", {
                context: context,
                point: toJson(point),
                user: toJson(user),
                err: error,
                errorStatus: errorStatus ? errorStatus : 500,
            });
        }
        if (errorStatus) {
            res.sendStatus(errorStatus);
        }
        else {
            res.sendStatus(500);
        }
    }
    else {
        res.send(point);
    }
};
var validateEmbedUrl = function (urlIn) {
    var urlRegex = /((?:(http|https|Http|Https|rtsp|Rtsp):\/\/(?:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,64}(?:\:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,25})?\@)?)?((?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}\.)+(?:(?:aero|arpa|asia|a[cdefgilmnoqrstuwxz])|(?:biz|b[abdefghijmnorstvwyz])|(?:cat|com|coop|c[acdfghiklmnoruvxyz])|d[ejkmoz]|(?:edu|e[cegrstu])|f[ijkmor]|(?:gov|g[abdefghilmnpqrstuwy])|h[kmnrtu]|(?:info|int|i[delmnoqrst])|(?:jobs|j[emop])|k[eghimnrwyz]|l[abcikrstuvy]|(?:mil|mobi|museum|m[acdghklmnopqrstuvwxyz])|(?:name|net|n[acefgilopruz])|(?:org|om)|(?:pro|p[aefghklmnrstwy])|qa|r[eouw]|s[abcdeghijklmnortuvyz]|(?:tel|travel|t[cdfghjklmnoprtvwz])|u[agkmsyz]|v[aceginu]|w[fs]|y[etu]|z[amw]))|(?:(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9])\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[0-9])))(?:\:\d{1,5})?)(\/(?:(?:[a-zA-Z0-9\;\/\?\:\@\&\=\#\~\-\.\+\!\*\'\(\)\,\_])|(?:\%[a-fA-F0-9]{2}))*)?(?:\b|$)/gi;
    var urls = urlRegex.exec(urlIn);
    return urls != null && urls.length > 0;
};
var loadPointWithAll = function (pointId, callback) {
    let outPoint;
    models.Point.findOne({
        where: {
            id: pointId,
        },
        attributes: [
            "id",
            "name",
            "content",
            "status",
            "value",
            "counter_quality_up",
            "counter_quality_down",
            "counter_flags",
            "embed_data",
            "data",
            "public_data",
            "language",
            "group_id",
            "post_id",
            "user_id",
            "parent_point_id",
            "created_at",
        ],
        order: [
            [models.PointRevision, "created_at", "asc"],
            [
                models.User,
                { model: models.Image, as: "UserProfileImages" },
                "created_at",
                "asc",
            ],
            [{ model: models.Audio, as: "PointAudios" }, "updated_at", "desc"],
        ],
        include: [
            {
                model: models.User,
                attributes: [
                    "id",
                    "name",
                    "email",
                    "facebook_id",
                    "twitter_id",
                    "google_id",
                    "github_id",
                ],
                required: false,
                include: [
                    {
                        model: models.Image,
                        as: "UserProfileImages",
                        required: false,
                        through: { attributes: [] }
                    },
                ],
            },
            {
                model: models.PointRevision,
                required: false,
            },
            {
                model: models.PointQuality,
                required: false,
                include: [
                    {
                        model: models.User,
                        attributes: ["id", "name", "email"],
                        required: false,
                    },
                ],
            },
            {
                model: models.Audio,
                required: false,
                attributes: ["id", "formats", "updated_at", "listenable"],
                as: "PointAudios",
            },
            {
                model: models.Post,
                required: false,
                attributes: ["id", "name", "group_id"],
                include: [
                    {
                        model: models.Group,
                        attributes: ["id", "name", "configuration"],
                        required: false,
                        include: [
                            {
                                model: models.Community,
                                attributes: ["id", "name"],
                                required: false,
                            },
                        ],
                    },
                ],
            },
        ],
    })
        .then(function (point) {
        if (point) {
            outPoint = point;
            async.parallel([
                (parallelCallback) => {
                    models.Point.getVideosForPoints([point.id], (error, videos) => {
                        if (error) {
                            parallelCallback(error);
                        }
                        else {
                            outPoint.setDataValue("PointVideos", videos);
                            outPoint.PointVideos = videos;
                            parallelCallback();
                        }
                    });
                },
                (parallelCallback) => {
                    models.Point.setOrganizationUsersForPoints([outPoint], (error) => {
                        parallelCallback(error);
                    });
                },
                (parallelCallback) => {
                    // Load fallacy labels for this point (both point and comment types)
                    log.info("Loading fallacy labels for point", { pointId: point.id });
                    models.CommentFallacyLabels.findOne({
                        where: {
                            content_type: { [models.Sequelize.Op.in]: ["point", "comment"] },
                            content_id: point.id,
                        },
                        attributes: ["labels", "scores", "advice", "rewrite"],
                        order: [["created_at", "DESC"]],
                    })
                        .then((fallacyData) => {
                        if (fallacyData) {
                            log.info("Fallacy data found for point", {
                                pointId: point.id,
                                fallacyCount: fallacyData.labels?.length || 0
                            });
                            outPoint.setDataValue("fallacyLabels", fallacyData.labels || []);
                            outPoint.setDataValue("fallacyAdvice", fallacyData.advice);
                            outPoint.setDataValue("fallacyRewrite", fallacyData.rewrite);
                        }
                        else {
                            log.info("No fallacy data found for point", { pointId: point.id });
                        }
                        parallelCallback();
                    })
                        .catch((error) => {
                        // Don't fail the whole request if fallacy loading fails
                        log.warn("Failed to load fallacy labels", { error, pointId: point.id });
                        parallelCallback();
                    });
                },
            ], (error) => {
                callback(error, outPoint);
            });
        }
        else {
            callback("Can't find point");
        }
    })
        .catch(function (error) {
        callback(error);
    });
};
router.put("/:id/report", auth.can("vote on point"), function (req, res) {
    models.Point.findOne({
        where: {
            id: req.params.id,
        },
    }).then(function (point) {
        if (point) {
            models.Post.findOne({
                where: {
                    id: point.post_id,
                },
                include: [
                    {
                        model: models.Group,
                        required: true,
                        attributes: ["id"],
                        include: [
                            {
                                model: models.Community,
                                required: true,
                                attributes: ["id"],
                                include: [
                                    {
                                        model: models.Domain,
                                        required: true,
                                        attributes: ["id"],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            })
                .then(function (post) {
                if (post) {
                    point.report(req, "user", post, function (error) {
                        if (error) {
                            log.error("Point Report Error", {
                                context: "report",
                                post: post ? toJson(post) : null,
                                user: toJson(req.user),
                                err: error,
                            });
                            res.sendStatus(500);
                        }
                        else {
                            log.info("Point Report Created", {
                                postId: post ? post.id : -1,
                                userId: req.user ? req.user.id : -1,
                            });
                            res.sendStatus(200);
                        }
                    });
                }
                else {
                    log.error("Point Report", {
                        context: "report",
                        post: toJson(post),
                        user: toJson(req.user),
                        err: "Could not created post",
                    });
                    res.sendStatus(500);
                }
            })
                .catch(function (error) {
                log.error("Point Report", {
                    context: "report",
                    user: toJson(req.user),
                    err: error,
                });
                res.sendStatus(500);
            });
        }
        else {
            res.sendStatus(404);
        }
    });
});
router.get("/:parentPointId/comments", auth.can("view point"), function (req, res) {
    models.Point.findAll({
        where: {
            parent_point_id: req.params.parentPointId,
        },
        order: [
            ["created_at", "asc"],
            [
                models.PointRevision,
                models.User,
                { model: models.Image, as: "UserProfileImages" },
                "created_at",
                "asc",
            ],
            [models.PointRevision, "created_at", "asc"],
        ],
        include: [
            {
                model: models.PointRevision,
                include: [
                    {
                        model: models.User,
                        attributes: models.User.defaultAttributesWithSocialMediaPublic,
                        include: [
                            {
                                model: models.Image,
                                as: "UserProfileImages",
                                required: false,
                                through: { attributes: [] }
                            },
                        ],
                    },
                ],
            },
        ],
    })
        .then(function (comments) {
        log.info("Point Comment for Parent Point", {
            context: "comment",
            user: req.user ? toJson(req.user.simple()) : null,
        });
        res.send(comments);
    })
        .catch(function (error) {
        log.error("Could not get comments for parent point", {
            err: error,
            context: "comment",
            user: req.user ? toJson(req.user.simple()) : null,
        });
        res.sendStatus(500);
    });
});
router.get("/:parentPointId/commentsCount", auth.can("view point"), function (req, res) {
    models.Point.count({
        where: {
            parent_point_id: req.params.parentPointId,
        },
        include: [
            {
                model: models.PointRevision,
                include: [
                    {
                        model: models.User,
                        attributes: ["id", "name", "created_at"],
                    },
                ],
            },
        ],
        order: [["created_at", "asc"]],
    })
        .then(function (commentsCount) {
        log.info("Point Comment Count for Parent Point", {
            context: "comment",
            user: req.user ? toJson(req.user.simple()) : null,
        });
        res.send({ count: commentsCount });
    })
        .catch(function (error) {
        log.error("Could not get comments count for parent point", {
            err: error,
            context: "comment",
            user: req.user ? toJson(req.user.simple()) : null,
        });
        res.sendStatus(500);
    });
});
router.post("/:parentPointId/comment", auth.isLoggedInNoAnonymousCheck, auth.can("add to point"), function (req, res) {
    models.Point.createComment(req, { parent_point_id: req.params.parentPointId, comment: req.body.comment }, async function (error, createdPoint) {
        if (error) {
            log.error("Could not save comment point on parent point", {
                err: error,
                context: "comment",
                user: toJson(req.user.simple()),
            });
            res.sendStatus(500);
        }
        else {
            try {
                // Analysis is now done in frontend, but we still persist it here
                const context = {
                    contentType: "comment",
                    text: req.body?.comment?.content || "",
                    userId: req.user.id,
                    groupId: createdPoint?.group_id,
                    commentId: createdPoint?.id,
                    ideaId: createdPoint?.post_id,
                };
                // Only run analysis if not already provided by frontend
                let analysis = null;
                if (req.body?.delibAnalysis) {
                    // Frontend already did the analysis, just persist it
                    analysis = req.body.delibAnalysis;
                }
                else {
                    // Fallback: do the analysis here
                    analysis = await delibAiService.analyzeContent(context);
                }
                await delibAiService.persistAnalysis(context, analysis);
                if (analysis && delibAiService.shouldBlock(analysis.moderation) && createdPoint) {
                    await models.Point.update({ status: "blocked" }, { where: { id: createdPoint.id } });
                }
                if (analysis && delibAiService.shouldWarn(analysis.moderation)) {
                    await models.ModerationEvents.create({
                        event_name: "Fallacy Warning Shown",
                        properties: {
                            contentType: "comment",
                            contentId: createdPoint?.id,
                            userId: req.user.id,
                        },
                    });
                }
                log.info("Point Comment Created on Parent Point", {
                    context: "comment",
                    user: toJson(req.user.simple()),
                });
                res.send({
                    status: "ok",
                    commentId: createdPoint?.id,
                    moderation: analysis ? analysis.moderation : null,
                    delibAi: analysis ? analysis.delibResult : null,
                });
            }
            catch (analysisError) {
                log.error("DelibAI analysis failed", {
                    err: analysisError,
                    context: "comment",
                    user: toJson(req.user.simple()),
                });
                res.send({ status: "ok", commentId: createdPoint?.id });
            }
        }
    });
});
router.put("/:pointId", auth.can("edit point"), function (req, res) {
    if (!req.body.content) {
        req.body.content = "";
    }
    var point = models.Point.findOne({
        where: {
            id: req.params.pointId,
        },
    })
        .then(function (point) {
        var maxNumberOfPointsBeforeEditFrozen = 5;
        if (point.counter_quality_up + point.counter_quality_down <=
            maxNumberOfPointsBeforeEditFrozen) {
            var pointRevision = models.PointRevision.build({
                group_id: point.group_id,
                post_id: point.post_id,
                content: req.body.content,
                user_id: req.user.id,
                status: point.status,
                value: point.value,
                point_id: point.id,
                user_agent: req.useragent.source,
                ip_address: req.clientIp,
            });
            pointRevision.save().then(function () {
                log.info("PointRevision Created", {
                    pointRevisionId: pointRevision ? pointRevision.id : -1,
                    context: "create",
                    userId: req.user ? req.user.id : -1,
                });
                queue.add("process-similarities", { type: "update-collection", pointId: point.id }, "low");
                models.Group.findOne({
                    where: { id: point.group_id },
                    attributes: ["id", "community_id"],
                    include: [
                        {
                            model: models.Community,
                            attributes: ["id", "domain_id"],
                        },
                    ],
                }).then(function (group) {
                    models.AcActivity.createActivity({
                        type: "activity.point.edited",
                        userId: point.user_id,
                        domainId: group && group.Community
                            ? group.Community.domain_id
                            : req.ypDomain.id,
                        //          communityId: req.ypCommunity ?  req.ypCommunity.id : null,
                        groupId: point.group_id,
                        postId: point.post_id,
                        pointId: point.id,
                        access: models.AcActivity.ACCESS_PUBLIC,
                    }, function (error) {
                        loadPointWithAll(point.id, function (error, loadedPoint) {
                            if (error) {
                                log.error("Could not reload point point", {
                                    err: error,
                                    context: "createPoint",
                                    user: toJson(req.user.simple()),
                                });
                                res.sendStatus(500);
                            }
                            else {
                                if (loadedPoint.PointRevisions &&
                                    loadedPoint.PointRevisions.length > 0 &&
                                    loadedPoint.PointRevisions[loadedPoint.PointRevisions.length - 1].content !== "") {
                                    log.info("process-moderation point toxicity after create point");
                                    queue.add("process-moderation", {
                                        type: "estimate-point-toxicity",
                                        pointId: loadedPoint.id,
                                    }, "high");
                                }
                                else {
                                    log.info("No process-moderation toxicity for empty text on point");
                                }
                                res.send(loadedPoint);
                            }
                        });
                    });
                });
            });
        }
        else {
            log.error("Trying to edit point with too many point qualities", {
                point: toJson(point),
                context: "edit",
                user: toJson(req.user),
            });
            res.sendStatus(401);
        }
    })
        .catch(function (error) {
        sendPointOrError(res, null, "edit", req.user, error);
    });
});
router.get("/:id/translatedText", auth.can("view point"), function (req, res) {
    if (req.query.textType.indexOf("point") > -1) {
        models.Point.findOne({
            where: {
                id: req.params.id,
            },
            order: [[models.PointRevision, "created_at", "asc"]],
            attributes: ["id", "public_data"],
            include: [
                {
                    model: models.PointRevision,
                    attributes: ["id", "content"],
                },
            ],
        })
            .then(function (point) {
            if (point) {
                models.AcTranslationCache.getTranslation(req, point, function (error, translation) {
                    if (error) {
                        sendPointOrError(res, req.params.id, "translated", req.user, error, 500);
                    }
                    else {
                        res.send(translation);
                    }
                });
            }
            else {
                sendPointOrError(res, req.params.id, "translated", req.user, "Not found", 404);
            }
        })
            .catch(function (error) {
            sendPointOrError(res, null, "translated", req.user, error);
        });
    }
    else {
        sendPointOrError(res, req.params.id, "translated", req.user, "Wrong textType", 401);
    }
});
router.get("/:id/videoTranscriptStatus", auth.can("view point"), function (req, res) {
    loadPointWithAll(req.params.id, (error, point) => {
        if (error) {
            sendPointOrError(res, req.params.id, "videoTranscriptStatus", req.user, error, 500);
        }
        else if (point.PointVideos && point.PointVideos.length > 0) {
            models.Video.findOne({
                where: {
                    id: point.PointVideos[0].id,
                },
            })
                .then((video) => {
                if (video.meta.transcript && video.meta.transcript.text) {
                    point
                        .save()
                        .then((savedPoint) => {
                        var pointRevision = models.PointRevision.build({
                            group_id: savedPoint.group_id,
                            post_id: savedPoint.post_id,
                            content: video.meta.transcript.text,
                            user_id: req.user.id,
                            status: savedPoint.status,
                            value: savedPoint.value,
                            point_id: savedPoint.id,
                            user_agent: req.useragent.source,
                            ip_address: req.clientIp,
                        });
                        pointRevision
                            .save()
                            .then(() => {
                            loadPointWithAll(point.id, function (error, loadedPoint) {
                                if (error) {
                                    log.error("Could not reload point point", {
                                        err: error,
                                        context: "createPoint",
                                        user: toJson(req.user.simple()),
                                    });
                                    res.sendStatus(500);
                                }
                                else {
                                    log.info("process-moderation point toxicity after video transcript");
                                    queue.add("process-moderation", {
                                        type: "estimate-point-toxicity",
                                        pointId: loadedPoint.id,
                                    }, "high");
                                    res.send({ point: loadedPoint });
                                }
                            });
                        })
                            .catch((error) => {
                            sendPointOrError(res, req.params.id, "videoTranscriptStatus", req.user, error, 500);
                        });
                    })
                        .catch((error) => {
                        sendPointOrError(res, req.params.id, "videoTranscriptStatus", req.user, error, 500);
                    });
                }
                else if (video.meta.transcript && video.meta.transcript.error) {
                    res.send({ error: video.meta.transcript.error });
                }
                else {
                    res.send({ inProgress: true });
                }
            })
                .catch((error) => {
                sendPointOrError(res, req.params.id, "videoTranscriptStatus", req.user, error, 500);
            });
        }
        else {
            sendPointOrError(res, req.params.id, "videoTranscriptStatus", req.user, "No video for videoTranscriptStatus", 500);
        }
    });
});
router.get("/:id/audioTranscriptStatus", auth.can("view point"), function (req, res) {
    loadPointWithAll(req.params.id, (error, point) => {
        if (error) {
            sendPointOrError(res, req.params.id, "audioTranscriptStatus", req.user, error, 500);
        }
        else if (point.PointAudios && point.PointAudios.length > 0) {
            models.Audio.findOne({
                where: {
                    id: point.PointAudios[0].id,
                },
            })
                .then((audio) => {
                if (audio.meta.transcript && audio.meta.transcript.text) {
                    point
                        .save()
                        .then((savedPoint) => {
                        var pointRevision = models.PointRevision.build({
                            group_id: savedPoint.group_id,
                            post_id: savedPoint.post_id,
                            content: audio.meta.transcript.text,
                            user_id: req.user.id,
                            status: savedPoint.status,
                            value: savedPoint.value,
                            point_id: savedPoint.id,
                            user_agent: req.useragent.source,
                            ip_address: req.clientIp,
                        });
                        pointRevision
                            .save()
                            .then(() => {
                            loadPointWithAll(point.id, function (error, loadedPoint) {
                                if (error) {
                                    log.error("Could not reload point", {
                                        err: error,
                                        context: "createPoint",
                                        user: toJson(req.user.simple()),
                                    });
                                    res.sendStatus(500);
                                }
                                else {
                                    log.info("process-moderation point toxicity after audio transcript");
                                    queue.add("process-moderation", {
                                        type: "estimate-point-toxicity",
                                        pointId: loadedPoint.id,
                                    }, "high");
                                    res.send({ point: loadedPoint });
                                }
                            });
                        })
                            .catch((error) => {
                            sendPointOrError(res, req.params.id, "audioTranscriptStatus", req.user, error, 500);
                        });
                    })
                        .catch((error) => {
                        sendPointOrError(res, req.params.id, "audioTranscriptStatus", req.user, error, 500);
                    });
                }
                else if (audio.meta.transcript && audio.meta.transcript.error) {
                    res.send({ error: audio.meta.transcript.error });
                }
                else {
                    res.send({ inProgress: true });
                }
            })
                .catch((error) => {
                sendPointOrError(res, req.params.id, "audioTranscriptStatus", req.user, error, 500);
            });
        }
        else {
            sendPointOrError(res, req.params.id, "audioTranscriptStatus", req.user, "No audio for audioTranscriptStatus", 500);
        }
    });
});
router.post("/:groupId", auth.can("create point"), function (req, res) {
    log.info("In POST createPoint");
    if (!req.body.content) {
        req.body.content = "";
    }
    var point = models.Point.build({
        group_id: req.params.groupId,
        post_id: req.body.postId,
        content: req.body.content,
        value: req.body.value,
        user_id: req.user.id,
        status: "published",
        user_agent: req.useragent.source,
        ip_address: req.clientIp,
        data: {
            browserId: req.body.pointBaseId,
            browserFingerprint: req.body.pointValCode,
            browserFingerprintConfidence: req.body.pointConf,
            originalQueryString: req.body.originalQueryString,
            userLocale: req.body.userLocale,
            userAutoTranslate: req.body.userAutoTranslate,
            referrer: req.body.referrer,
            url: req.body.url,
            screen_width: req.body.screen_width,
        },
    });
    point
        .save()
        .then(function () {
        log.info("Point Created", {
            pointId: point ? point.id : -1,
            context: "create",
            userId: req.user ? req.user.id : -1,
        });
        async.parallel([
            (parallelCallback) => {
                var pointRevision = models.PointRevision.build({
                    group_id: point.group_id,
                    post_id: point.post_id,
                    content: point.content,
                    user_id: req.user.id,
                    status: point.status,
                    value: point.value,
                    point_id: point.id,
                    user_agent: req.useragent.source,
                    ip_address: req.clientIp,
                });
                pointRevision.save().then(function () {
                    log.info("PointRevision Created", {
                        pointRevisionId: pointRevision ? pointRevision.id : -1,
                        context: "create",
                        userId: req.user ? req.user.id : -1,
                    });
                    parallelCallback();
                });
            },
            (parallelCallback) => {
                models.Group.findOne({
                    where: { id: point.group_id },
                    attributes: ["id", "community_id"],
                    include: [
                        {
                            model: models.Community,
                            attributes: ["id", "domain_id"],
                        },
                    ],
                }).then(function (group) {
                    models.AcActivity.createActivity({
                        type: "activity.point.new",
                        userId: point.user_id,
                        domainId: group && group.Community
                            ? group.Community.domain_id
                            : req.ypDomain.id,
                        //        communityId: req.ypCommunity ?  req.ypCommunity.id : null,
                        groupId: point.group_id,
                        postId: point.post_id,
                        pointId: point.id,
                        access: models.AcActivity.ACCESS_PUBLIC,
                    }, function (error) {
                        parallelCallback(error);
                    });
                });
            },
            (parallelCallback) => {
                models.Group.addUserToGroupIfNeeded(point.group_id, req, function () {
                    parallelCallback();
                });
            },
            (parallelCallback) => {
                models.Post.findOne({
                    where: { id: point.post_id },
                    attributes: ["id", "counter_points", "group_id"],
                }).then(function (post) {
                    if (post) {
                        post.updateAllExternalCounters(req, "up", "counter_points", function () {
                            post.increment("counter_points");
                            parallelCallback();
                        });
                    }
                    else {
                        parallelCallback("Post not found for point");
                    }
                });
            },
            (parallelCallback) => {
                if (req.body.videoId) {
                    models.Video.completeUploadAndAddToPoint(req, res, { pointId: point.id, videoId: req.body.videoId }, (error) => {
                        if (error) {
                            parallelCallback(error);
                        }
                        else {
                            if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
                                const workPackage = {
                                    browserLanguage: req.headers["accept-language"]
                                        ? req.headers["accept-language"].split(",")[0]
                                        : "en-US",
                                    appLanguage: req.body.appLanguage,
                                    videoId: req.body.videoId,
                                    type: "create-video-transcript",
                                };
                                queue.add("process-voice-to-text", workPackage, "high");
                            }
                            parallelCallback();
                        }
                    });
                }
                else {
                    parallelCallback();
                }
            },
            (parallelCallback) => {
                if (req.body.audioId) {
                    models.Audio.completeUploadAndAddToPoint(req, res, { pointId: point.id, audioId: req.body.audioId }, (error) => {
                        if (error) {
                            parallelCallback(error);
                        }
                        else {
                            if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
                                const workPackage = {
                                    browserLanguage: req.headers["accept-language"]
                                        ? req.headers["accept-language"].split(",")[0]
                                        : "en-US",
                                    appLanguage: req.body.appLanguage,
                                    audioId: req.body.audioId,
                                    type: "create-audio-transcript",
                                };
                                queue.add("process-voice-to-text", workPackage, "high");
                            }
                            parallelCallback();
                        }
                    });
                }
                else {
                    parallelCallback();
                }
            },
        ], async (error) => {
            if (error) {
                log.error(error);
                res.sendStatus(500);
            }
            else {
                if (point.content && point.content !== "") {
                    log.info("process-moderation point toxicity after create point");
                    queue.add("process-moderation", { type: "estimate-point-toxicity", pointId: point.id }, "high");
                    queue.add("process-similarities", { type: "update-collection", pointId: point.id }, "low");
                }
                else {
                    log.info("No process-moderation toxicity for empty text on point");
                }
                queue.add("process-moderation", { type: "point-review-and-annotate-images", pointId: point.id }, "medium");
                // Analysis is now done in frontend, but we persist it here
                // Run DelibAI analysis synchronously before sending response
                let delibAnalysis = null;
                try {
                    if (point && point.content) {
                        log.info("Persisting DelibAI analysis for point", {
                            pointId: point.id,
                            contentLength: point.content.length
                        });
                        const context = {
                            contentType: "point",
                            text: point.content || "",
                            userId: req.user.id,
                            groupId: point.group_id,
                            pointId: point.id,
                            ideaId: point.post_id,
                        };
                        // Only run analysis if not already provided by frontend
                        let analysis = null;
                        if (req.body?.delibAnalysis) {
                            // Frontend already did the analysis, just persist it
                            analysis = req.body.delibAnalysis;
                        }
                        else {
                            // Fallback: do the analysis here
                            analysis = await delibAiService.analyzeContent(context);
                        }
                        log.info("DelibAI analysis ready to persist", {
                            pointId: point.id,
                            hasModeration: !!analysis?.moderation,
                            hasDelibResult: !!analysis?.delibResult
                        });
                        await delibAiService.persistAnalysis(context, analysis);
                        // Block only if Perspective decides to block
                        if (analysis && delibAiService.shouldBlock(analysis.moderation)) {
                            await models.Point.update({ status: "blocked" }, { where: { id: point.id } });
                        }
                        delibAnalysis = {
                            fallacies: analysis?.delibResult?.fallacies || [],
                            ontologyHints: analysis?.delibResult?.ontologyHints || null,
                            perspectiveWarning: analysis?.moderation?.decision === "block" ||
                                analysis?.moderation?.decision === "soft_warning",
                            suggestedRewrite: analysis?.delibResult?.rewrite || null,
                        };
                    }
                }
                catch (analysisError) {
                    log.error("DelibAI analysis failed for point create", {
                        err: analysisError,
                        context: "createPoint",
                    });
                }
                loadPointWithAll(point.id, function (error, loadedPoint) {
                    if (error) {
                        log.error("Could not reload point point", {
                            err: error,
                            context: "createPoint",
                            user: toJson(req.user.simple()),
                        });
                        res.sendStatus(500);
                    }
                    else {
                        // Convert to plain object to allow adding delibAiAnalysis
                        const pointResponse = loadedPoint.toJSON ? loadedPoint.toJSON() : loadedPoint;
                        if (delibAnalysis) {
                            pointResponse.delibAiAnalysis = delibAnalysis;
                            log.info("DelibAI analysis attached to point response", {
                                pointId: point.id,
                                hasFallacies: delibAnalysis.fallacies?.length > 0,
                                hasRewrite: !!delibAnalysis.suggestedRewrite,
                                analysisObject: delibAnalysis,
                            });
                        }
                        else {
                            log.warn("DelibAI analysis was null for point", { pointId: point.id });
                        }
                        // Send point to DKG (non-blocking)
                        if (loadedPoint && loadedPoint.content) {
                            sendPointToDKG(loadedPoint).catch(err => {
                                log.error("DKG send failed", { pointId: loadedPoint.id, error: err.message });
                            });
                        }
                        const newPointRedisKey = `newUserPoint_${req.user.id}`;
                        req.redisClient.setEx(newPointRedisKey, 30, JSON.stringify({}));
                        res.send(pointResponse);
                    }
                });
            }
        });
    })
        .catch(function (error) {
        sendPointOrError(res, null, "create", req.user, error);
    });
});
router.delete("/:id", auth.can("delete point"), function (req, res) {
    models.Point.findOne({
        where: { id: req.params.id },
        include: [
            {
                model: models.Post,
                required: false,
            },
        ],
    })
        .then(function (point) {
        point.deleted = true;
        point.save().then(function () {
            log.info("Point Deleted", {
                point: toJson(point),
                context: "delete",
                user: toJson(req.user),
            });
            queue.add("process-similarities", { type: "update-collection", pointId: point.id }, "low");
            queue.add("process-deletion", {
                type: "delete-point-content",
                pointId: point.id,
                userId: req.user.id,
            }, "critical");
            if (point.Post) {
                point.Post.updateAllExternalCounters(req, "down", "counter_points", function () {
                    point.Post.decrement("counter_points");
                    res.sendStatus(200);
                });
            }
            else {
                res.sendStatus(200);
            }
        });
    })
        .catch(function (error) {
        sendPointOrError(res, null, "delete", req.user, error);
    });
});
router.post("/:id/pointQuality", auth.can("vote on point"), function (req, res) {
    var point, post;
    models.PointQuality.findOne({
        where: { point_id: req.params.id, user_id: req.user.id },
        include: [
            {
                model: models.Point,
                attributes: ["id", "group_id", "post_id"],
                include: [
                    {
                        model: models.Post,
                        attributes: ["id", "group_id"],
                        required: false,
                    },
                ],
            },
        ],
    }).then(function (pointQuality) {
        var oldPointQualityValue;
        if (pointQuality) {
            point = pointQuality.Point;
            if (pointQuality.value > 0)
                oldPointQualityValue = 1;
            else if (pointQuality.value < 0)
                oldPointQualityValue = -1;
            pointQuality.value = req.body.value;
            pointQuality.status = "active";
            pointQuality.set("data", {
                browserId: req.body.qualityBaseId,
                browserFingerprint: req.body.qualityValCode,
                browserFingerprintConfidence: req.body.qualityConf,
            });
        }
        else {
            pointQuality = models.PointQuality.build({
                point_id: req.params.id,
                value: req.body.value,
                user_id: req.user.id,
                data: {
                    browserId: req.body.qualityBaseId,
                    browserFingerprint: req.body.qualityValCode,
                    browserFingerprintConfidence: req.body.qualityConf,
                },
                status: "active",
                user_agent: req.useragent.source,
                ip_address: req.clientIp,
            });
        }
        pointQuality.save().then(function () {
            log.info("PointQuality Created or Updated", {
                pointQualityId: pointQuality ? pointQuality.id : -1,
                userId: req.user ? req.user.id : -1,
            });
            async.series([
                function (seriesCallback) {
                    if (point) {
                        seriesCallback();
                    }
                    else {
                        models.Point.findOne({
                            where: { id: pointQuality.point_id },
                            attributes: ["id", "post_id", "group_id"],
                        }).then(function (results) {
                            if (results) {
                                point = results;
                                seriesCallback();
                            }
                            else {
                                seriesCallback("Can't find point");
                            }
                        });
                    }
                },
                function (seriesCallback) {
                    models.Group.findOne({
                        where: { id: point.group_id },
                        attributes: ["id", "community_id"],
                        include: [
                            {
                                model: models.Community,
                                attributes: ["id", "domain_id"],
                            },
                        ],
                    }).then(function (group) {
                        models.AcActivity.createActivity({
                            type: pointQuality.value > 0
                                ? "activity.point.helpful.new"
                                : "activity.point.unhelpful.new",
                            userId: pointQuality.user_id,
                            domainId: group && group.Community
                                ? group.Community.domain_id
                                : req.ypDomain.id,
                            //            communityId: req.ypCommunity ?  req.ypCommunity.id : null,
                            pointQualityId: pointQuality.id,
                            groupId: point.group_id,
                            postId: point.post_id,
                            pointId: point.id,
                            access: models.AcActivity.ACCESS_PUBLIC,
                        }, function (error) {
                            seriesCallback(error);
                        });
                    });
                },
                function (seriesCallback) {
                    if (point && point.group_id) {
                        models.Group.addUserToGroupIfNeeded(point.group_id, req, function () {
                            seriesCallback();
                        });
                    }
                    else {
                        seriesCallback();
                    }
                },
            ], function (error) {
                if (error) {
                    log.error("Point Quality Error", {
                        context: "create",
                        pointQuality: toJson(pointQuality),
                        user: toJson(req.user),
                        err: error,
                        errorStatus: 500,
                    });
                    res.sendStatus(500);
                }
                else {
                    decrementOldPointQualityCountersIfNeeded(oldPointQualityValue, req.params.id, pointQuality, function () {
                        if (pointQuality.value > 0) {
                            changePointCounter(req.params.id, "counter_quality_up", 1, function () {
                                res.send({
                                    pointQuality: pointQuality,
                                    oldPointQualityValue: oldPointQualityValue,
                                });
                            });
                        }
                        else if (pointQuality.value < 0) {
                            changePointCounter(req.params.id, "counter_quality_down", 1, function () {
                                res.send({
                                    pointQuality: pointQuality,
                                    oldPointQualityValue: oldPointQualityValue,
                                });
                            });
                        }
                        else {
                            log.error("PointQuality Error", {
                                pointQuality: toJson(pointQuality),
                                context: "createOrUpdate",
                                user: toJson(req.user),
                            });
                            res.status(500);
                        }
                    });
                }
            });
        });
    });
});
router.delete("/:id/pointQuality", auth.can("vote on point"), function (req, res) {
    models.PointQuality.findOne({
        where: { point_id: req.params.id, user_id: req.user.id },
    }).then(function (pointQuality) {
        if (pointQuality) {
            var oldPointQualityValue;
            if (pointQuality.value > 0)
                oldPointQualityValue = 1;
            else if (pointQuality.value < 0)
                oldPointQualityValue = -1;
            pointQuality.value = 0;
            //pointQuality.deleted = true;
            pointQuality.save().then(function () {
                log.info("PointQuality Deleted", {
                    pointQualityId: pointQuality ? pointQuality.id : -1,
                    userId: req.user ? req.user.id : -1,
                });
                if (oldPointQualityValue > 0) {
                    changePointCounter(req.params.id, "counter_quality_up", -1, function () {
                        res.status(200).send({
                            pointQuality: pointQuality,
                            oldPointQualityValue: oldPointQualityValue,
                        });
                    });
                }
                else if (oldPointQualityValue < 0) {
                    changePointCounter(req.params.id, "counter_quality_down", -1, function () {
                        res.status(200).send({
                            pointQuality: pointQuality,
                            oldPointQualityValue: oldPointQualityValue,
                        });
                    });
                }
                else {
                    log.error("Strange state of pointQualities");
                    res.status(200).send({
                        pointQuality: pointQuality,
                        oldPointQualityValue: oldPointQualityValue,
                    });
                }
            });
        }
        else {
            log.error("PointQuality Not Found", {
                pointQuality: toJson(pointQuality),
                context: "delete",
                user: toJson(req.user),
            });
            res.sendStatus(404);
        }
    });
});
const translateToObsFormat = (json) => {
    return [
        {
            url: json.ogUrl,
            type: json.ogType,
            title: json.ogTitle,
            version: "1.0",
            description: json.ogDescription,
            provider_url: json.ogUrl,
            request_url: json.requestUrl,
            provider_name: json.ogSiteName,
            thumbnail_url: json.ogImage ? json.ogImage[0].url : "",
            thumbnail_width: json.ogImage ? json.ogImage[0].width : "",
            thumbnail_height: json.ogImage ? json.ogImage[0].height : "",
        },
    ];
};
router.get("/url_preview", auth.isLoggedInNoAnonymousCheck, function (req, res) {
    if (req.query.url && validateEmbedUrl(req.query.url)) {
        log.info("Before ogs", { url: req.query.url });
        const userAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";
        ogs({
            url: req.query.url,
            fetchOptions: { headers: { "user-agent": userAgent } },
        }).then((data) => {
            const { error, html, result, response } = data;
            log.info("After ogs", { url: req.query.url });
            if (error && result && result.error === "Page not found") {
                res.sendStatus(404);
            }
            else if (error) {
                log.error("Open graph not working", {
                    err: error,
                    url: req.query.url,
                    context: "url_preview"
                });
                res.sendStatus(500);
            }
            else {
                log.info("Before translateToObsFormat", {
                    url: req.query.url,
                    result: result,
                });
                res.send(translateToObsFormat(result));
            }
        }).catch((error) => {
            log.error("Open graph not working", {
                err: error,
                url: req.query.url,
                context: "url_preview"
            });
            res.send([{}]);
        });
    }
    else {
        log.error("Url not found or not valid", {
            url: req.params.url,
            context: "url_preview",
            user: toJson(req.user),
        });
        res.sendStatus(404);
    }
});
module.exports = router;
